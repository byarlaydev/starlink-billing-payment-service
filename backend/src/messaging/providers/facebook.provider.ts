import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessagingProvider, QuickReply } from '../interfaces/messaging-provider.interface';

@Injectable()
export class FacebookMessagingProvider implements MessagingProvider {
  private readonly logger = new Logger(FacebookMessagingProvider.name);
  private readonly pageAccessToken: string;

  constructor(private readonly configService: ConfigService) {
    this.pageAccessToken = this.configService.get<string>('FB_PAGE_ACCESS_TOKEN', '');
  }

  getName(): string {
    return 'facebook';
  }

  async sendMessage(recipientId: string, text: string): Promise<void> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v19.0/me/messages?access_token=${this.pageAccessToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: recipientId },
            message: { text },
          }),
        },
      );

      if (!response.ok) {
        this.logger.error(`Failed to send message: ${await response.text()}`);
      }
    } catch (error) {
      this.logger.error('Error sending Messenger message', error);
    }
  }

  async sendQuickReplies(recipientId: string, text: string, replies: QuickReply[]): Promise<void> {
    try {
      await fetch(
        `https://graph.facebook.com/v19.0/me/messages?access_token=${this.pageAccessToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: recipientId },
            message: {
              text,
              quick_replies: replies.map(r => ({
                content_type: 'text',
                title: r.title,
                payload: r.payload,
              })),
            },
          }),
        },
      );
    } catch (error) {
      this.logger.error('Error sending quick replies', error);
    }
  }
}
