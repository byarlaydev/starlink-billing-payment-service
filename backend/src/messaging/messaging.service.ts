import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../modules/settings/settings.service';
import { MessagingProvider, QuickReply } from './interfaces/messaging-provider.interface';
import { FacebookMessagingProvider } from './providers/facebook.provider';
import { InventMessagingProvider } from './providers/invent.provider';

@Injectable()
export class MessagingService implements MessagingProvider {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly facebookProvider: FacebookMessagingProvider,
    private readonly inventProvider: InventMessagingProvider,
  ) {}

  getName(): string {
    return 'messaging-facade';
  }

  private async getActiveProvider(): Promise<MessagingProvider> {
    const provider = await this.settingsService.get('messenger', 'provider');
    if (provider === 'invent') {
      return this.inventProvider;
    }
    return this.facebookProvider;
  }

  async sendMessage(recipientId: string, text: string): Promise<void> {
    const provider = await this.getActiveProvider();
    this.logger.debug(`Sending via ${provider.getName()} to ${recipientId}`);
    await provider.sendMessage(recipientId, text);
  }

  async sendQuickReplies(recipientId: string, text: string, replies: QuickReply[]): Promise<void> {
    const provider = await this.getActiveProvider();
    await provider.sendQuickReplies(recipientId, text, replies);
  }

  getInventProvider(): InventMessagingProvider {
    return this.inventProvider;
  }

  getFacebookProvider(): FacebookMessagingProvider {
    return this.facebookProvider;
  }
}
