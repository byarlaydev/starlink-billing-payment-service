import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../config/prisma.service';
import { SettingsService } from '../modules/settings/settings.service';
import { InventMessagingProvider } from './providers/invent.provider';

@Injectable()
export class InventPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InventPollingService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private isPolling = false;
  private lastPollTime: Date | null = null;
  private recentMessageIds = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly inventProvider: InventMessagingProvider,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    await this.startPollingIfEnabled();
  }

  onModuleDestroy() {
    this.stopPolling();
  }

  async startPollingIfEnabled() {
    const provider = await this.settingsService.get('messenger', 'provider');
    if (provider === 'invent') {
      this.startPolling();
    }
  }

  startPolling() {
    if (this.intervalId) return;

    this.logger.log('Starting Invent polling service (10s interval)');
    this.intervalId = setInterval(() => this.poll(), 10000);
    this.poll();
  }

  stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.log('Stopped Invent polling service');
    }
  }

  async restartPolling() {
    this.stopPolling();
    await this.startPollingIfEnabled();
  }

  private async poll() {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const chats = await this.inventProvider.fetchInboxChats();
      this.logger.debug(`Polled Invent inbox: ${chats.length} chats`);

      for (const chat of chats) {
        await this.processChat(chat);
      }

      this.lastPollTime = new Date();
    } catch (error) {
      this.logger.error('Error during Invent poll', error);
    } finally {
      this.isPolling = false;
    }
  }

  private async processChat(chat: any) {
    const chatId = chat.id;
    if (!chatId) return;

    const contactChannel = this.extractContactChannel(chat);
    if (!contactChannel) return;

    const psid = contactChannel.user_id;
    if (!psid) return;

    let customer = await this.prisma.customer.findUnique({
      where: { messengerPsid: psid },
    });

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          messengerPsid: psid,
          inventChatId: chatId,
          channel: 'invent',
          facebookName: contactChannel.name || null,
          fullName: contactChannel.name || null,
          contactNumber: contactChannel.phone || null,
          emailAddress: contactChannel.email || null,
          preferredLang: contactChannel.language === 'my' ? 'MY' : 'EN',
        },
      });
      await this.prisma.conversationContext.create({
        data: { customerId: customer.id },
      });
      this.logger.log(`Created new customer from Invent: ${psid}`);
    } else if (!customer.inventChatId) {
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: { inventChatId: chatId },
      });
    }

    const messages = await this.inventProvider.fetchChatMessages(chatId);
    this.logger.debug(`Chat ${chatId}: ${messages.length} messages fetched`);
    const newMessages = await this.filterUnprocessedMessages(messages);
    this.logger.debug(`Chat ${chatId}: ${newMessages.length} new messages`);

    if (newMessages.length > 0) {
      const sample = JSON.stringify(newMessages[0]).substring(0, 800);
      this.logger.warn(`Chat ${chatId}: FULL first new msg keys=${Object.keys(newMessages[0]).join(',')}, structure=${sample}`);
    }

    if (newMessages.length === 0) return;

    const byCreation = (a: any, b: any) =>
      new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();

    // Log first few messages that fail hasUserRole for debugging
    const nonUserMsg = newMessages.find((m: any) => !this.hasUserRole(m));
    if (nonUserMsg) {
      this.logger.warn(`Chat ${chatId}: sample non-user msg keys=${Object.keys(nonUserMsg).join(',')}, role=${nonUserMsg.role}, hasMessages=${!!nonUserMsg.messages}, sample=${JSON.stringify(nonUserMsg).substring(0, 300)}`);
    }

    const textMessages = newMessages
      .filter((m: any) => {
        const isUser = this.hasUserRole(m);
        const text = this.extractMessageText(m);
        if (isUser && !text) {
          this.logger.warn(`Chat ${chatId}: user message ${m.id} has no extractable text, keys=${Object.keys(m).join(',')}, msgs=${JSON.stringify(m.messages).substring(0, 200)}`);
        }
        return isUser && text;
      })
      .sort(byCreation);

    const nonTextMessages = newMessages
      .filter((m: any) => this.hasUserRole(m) && !this.extractMessageText(m));

    // Mark all non-text messages as processed so they don't keep showing as new
    for (const msg of nonTextMessages) {
      try {
        await this.prisma.webhookEvent.create({
          data: {
            eventId: `invent_${msg.id}`,
            source: 'invent',
            payload: { chatId, messageId: msg.id, senderPsid: psid, customerId: customer.id },
            processed: true,
          },
        });
      } catch {
        // ignore duplicate key errors
      }
    }

    if (nonTextMessages.length > 0) {
      this.logger.log(`Marked ${nonTextMessages.length} non-text messages as processed for chat ${chatId}`);
    }

    if (textMessages.length === 0) return;

    // Dedup: skip messages we've already seen in the last ~minute
    const deduped = textMessages.filter(m => !this.recentMessageIds.has(m.id));
    if (deduped.length === 0) return;

    // Prune old entries
    if (this.recentMessageIds.size > 100) {
      this.recentMessageIds.clear();
    }

    // Only process the most recent text message — skip historical ones
    // to avoid flooding the user with responses to every past message
    const latestMsg = deduped[deduped.length - 1];
    const skippedCount = deduped.length - 1;

    for (const msg of deduped.slice(0, skippedCount)) {
      const text = this.extractMessageText(msg);
      this.recentMessageIds.add(msg.id);
      try {
        await this.prisma.webhookEvent.create({
          data: {
            eventId: `invent_${msg.id}`,
            source: 'invent',
            payload: { chatId, messageId: msg.id, text, senderPsid: psid, customerId: customer.id },
            processed: true,
          },
        });
      } catch {
        // ignore duplicate key errors
      }
    }

    if (skippedCount > 0) {
      this.logger.log(`Skipped ${skippedCount} historical text messages for chat ${chatId}, processing only the most recent`);
    }

    const text = this.extractMessageText(latestMsg);
    if (!text) return;

    const messageId = latestMsg.id;
    this.recentMessageIds.add(messageId);

    const existing = await this.prisma.webhookEvent.findUnique({
      where: { eventId: `invent_${messageId}` },
    });
    if (existing) return;

    await this.prisma.webhookEvent.create({
      data: {
        eventId: `invent_${messageId}`,
        source: 'invent',
        payload: { chatId, messageId, text, senderPsid: psid, customerId: customer.id },
        processed: false,
      },
    });

    try {
      const { MessengerService } = await import('../modules/messenger/messenger.service');
      const messengerService = this.moduleRef.get(MessengerService, { strict: false });
      await messengerService.handleInventInbound(psid, text);

      await this.prisma.webhookEvent.update({
        where: { eventId: `invent_${messageId}` },
        data: { processed: true, processedAt: new Date() },
      });

      this.logger.log(`Processed Invent message ${messageId} from ${psid}`);
      this.recentMessageIds.add(messageId);
    } catch (error) {
      this.logger.error(`Failed to process Invent message ${messageId}`, error);
      await this.prisma.webhookEvent.update({
        where: { eventId: `invent_${messageId}` },
        data: { processed: true, processedAt: new Date() },
      });
    }
  }

  private extractContactChannel(chat: any): any {
    if (!chat.members || !Array.isArray(chat.members)) {
      this.logger.debug(`Chat ${chat.id}: no members array`);
      return null;
    }

    for (const member of chat.members) {
      if (member.role === 'MEMBER' && member.contact_channel) {
        return member.contact_channel;
      }
    }
    this.logger.debug(`Chat ${chat.id}: no MEMBER with contact_channel found, members: ${JSON.stringify(chat.members.map((m: any) => ({ role: m.role, hasChannel: !!m.contact_channel })))}`);
    return null;
  }

  private extractMessageText(msg: any): string | null {
    if (!msg.messages || !Array.isArray(msg.messages)) {
      // fallback: check top-level message/content fields
      const content = msg.message || msg.content;
      if (!content) return null;
      const parts = Array.isArray(content) ? content : [content];
      for (const part of parts) {
        if (typeof part === 'string') return part;
        if (part.type === 'text' && part.text) return part.text;
        if (part.text) return part.text;
      }
      return null;
    }

    for (const m of msg.messages) {
      if (m.role !== 'user') continue;
      if (!m.parts || !Array.isArray(m.parts)) continue;
      for (const part of m.parts) {
        if (part.type === 'text' && part.text) return part.text;
        if (part.type === 'option_selected') return part.value || part.label || null;
      }
    }
    return null;
  }

  private hasUserRole(msg: any): boolean {
    if (msg.role === 'user') return true;
    if (msg.messages && Array.isArray(msg.messages)) {
      return msg.messages.some((m: any) => m.role === 'user');
    }
    return false;
  }

  private async filterUnprocessedMessages(messages: any[]): Promise<any[]> {
    // Only consider user messages
    const userMessages = messages.filter((m: any) => this.hasUserRole(m));
    if (userMessages.length === 0) return [];

    const messageIds = userMessages.map((m: any) => `invent_${m.id}`);

    const processed = await this.prisma.webhookEvent.findMany({
      where: { eventId: { in: messageIds } },
      select: { eventId: true },
    });

    const processedSet = new Set(processed.map(p => p.eventId));
    return userMessages.filter((m: any) => !processedSet.has(`invent_${m.id}`));
  }

  getLastPollTime(): Date | null {
    return this.lastPollTime;
  }
}
