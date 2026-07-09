import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { SettingsService } from '../modules/settings/settings.service';
import { InventMessagingProvider } from './providers/invent.provider';
import { MessengerService } from '../modules/messenger/messenger.service';

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
    @Inject(forwardRef(() => MessengerService))
    private readonly messengerService: MessengerService,
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

    for (const msg of newMessages) {
      if (msg.role !== 'user') continue;

      const text = this.extractMessageText(msg);
      if (!text) {
        this.logger.warn(`Chat ${chatId}: could not extract text from message ${msg.id}, structure: ${JSON.stringify(msg).substring(0, 200)}`);
        continue;
      }

      const messageId = msg.id;

      const existing = await this.prisma.webhookEvent.findUnique({
        where: { eventId: `invent_${messageId}` },
      });
      if (existing) continue;

      await this.prisma.webhookEvent.create({
        data: {
          eventId: `invent_${messageId}`,
          source: 'invent',
          payload: { chatId, messageId, text, senderPsid: psid, customerId: customer.id },
          processed: false,
        },
      });

      try {
        await this.messengerService.handleInventInbound(psid, text);

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
        if (part.type === 'text' && part.text) {
          return part.text;
        }
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
