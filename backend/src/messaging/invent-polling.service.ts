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

    if (newMessages.length === 0) return;

    const userMessages = newMessages
      .filter((m: any) => m.role === 'user' && this.extractMessageText(m))
      .sort((a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

    if (userMessages.length === 0) return;

    // Only process the most recent user message — skip historical ones
    // to avoid flooding the user with responses to every past message
    const latestMsg = userMessages[userMessages.length - 1];
    const skippedCount = userMessages.length - 1;

    for (const msg of userMessages.slice(0, skippedCount)) {
      const text = this.extractMessageText(msg);
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
      this.logger.log(`Skipped ${skippedCount} historical messages for chat ${chatId}, processing only the most recent`);
    }

    const text = this.extractMessageText(latestMsg);
    if (!text) return;

    const messageId = latestMsg.id;

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

  private async filterUnprocessedMessages(messages: any[]): Promise<any[]> {
    const messageIds = messages
      .filter((m: any) => m.role === 'user')
      .map((m: any) => `invent_${m.id}`);

    if (messageIds.length === 0) return [];

    const processed = await this.prisma.webhookEvent.findMany({
      where: { eventId: { in: messageIds } },
      select: { eventId: true },
    });

    const processedSet = new Set(processed.map(p => p.eventId));
    return messages.filter((m: any) => !processedSet.has(`invent_${m.id}`));
  }

  getLastPollTime(): Date | null {
    return this.lastPollTime;
  }
}
