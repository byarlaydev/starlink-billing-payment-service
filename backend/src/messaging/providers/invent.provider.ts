import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { SettingsService } from '../../modules/settings/settings.service';
import { MessagingProvider, QuickReply } from '../interfaces/messaging-provider.interface';

@Injectable()
export class InventMessagingProvider implements MessagingProvider {
  private readonly logger = new Logger(InventMessagingProvider.name);
  private readonly baseUrl = 'https://api.useinvent.com';

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  getName(): string {
    return 'invent';
  }

  private async getApiKey(): Promise<string | null> {
    return this.settingsService.get('messenger', 'invent_api_key');
  }

  private async getOrgId(): Promise<string | null> {
    return this.settingsService.get('messenger', 'invent_org_id');
  }

  private async getChatId(recipientId: string): Promise<string | null> {
    const customer = await this.prisma.customer.findUnique({
      where: { messengerPsid: recipientId },
      select: { inventChatId: true },
    });
    return customer?.inventChatId || null;
  }

  async sendMessage(recipientId: string, text: string): Promise<void> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      this.logger.error('Invent API key not configured');
      return;
    }

    const chatId = await this.getChatId(recipientId);
    if (!chatId) {
      this.logger.warn(`No Invent chat ID found for recipient ${recipientId}`);
      return;
    }

    try {
      const response = await fetch(`${this.baseUrl}/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          message: [{ type: 'text', text }],
        }),
      });

      if (!response.ok) {
        this.logger.error(`Failed to send Invent message: ${response.status} ${await response.text()}`);
      }
    } catch (error) {
      this.logger.error('Error sending Invent message', error);
    }
  }

  async sendQuickReplies(recipientId: string, text: string, replies: QuickReply[]): Promise<void> {
    const optionsText = replies.map((r, i) => `${i + 1}. ${r.title}`).join('\n');
    const fullText = `${text}\n\n${optionsText}`;
    await this.sendMessage(recipientId, fullText);
  }

  async fetchInboxChats(): Promise<any[]> {
    const apiKey = await this.getApiKey();
    const orgId = await this.getOrgId();
    if (!apiKey || !orgId) {
      this.logger.error('Invent API key or org ID not configured');
      return [];
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/orgs/${orgId}/inbox?integration_id=messenger_bot&take=50`,
        {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        },
      );

      if (!response.ok) {
        this.logger.error(`Failed to fetch Invent inbox: ${response.status}`);
        return [];
      }

      return response.json();
    } catch (error) {
      this.logger.error('Error fetching Invent inbox', error);
      return [];
    }
  }

  async fetchChatMessages(chatId: string, fromDate?: string): Promise<any[]> {
    const apiKey = await this.getApiKey();
    if (!apiKey) return [];

    try {
      const params = new URLSearchParams({ take: '50' });
      if (fromDate) params.set('from_date', fromDate);

      const response = await fetch(
        `${this.baseUrl}/chats/${chatId}/messages?${params}`,
        {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        },
      );

      if (!response.ok) {
        this.logger.error(`Failed to fetch Invent messages: ${response.status}`);
        return [];
      }

      return response.json();
    } catch (error) {
      this.logger.error('Error fetching Invent messages', error);
      return [];
    }
  }
}
