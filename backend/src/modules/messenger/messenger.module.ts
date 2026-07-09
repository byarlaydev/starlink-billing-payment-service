import { Module } from '@nestjs/common';
import { MessengerService } from './messenger.service';
import { MessengerController } from './messenger.controller';
import { MessengerConversationService } from './messenger-conversation.service';
import { CustomersModule } from '../customers/customers.module';
import { BillingModule } from '../billing/billing.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [CustomersModule, BillingModule, SettingsModule],
  providers: [MessengerService, MessengerConversationService],
  controllers: [MessengerController],
  exports: [MessengerService, MessengerConversationService],
})
export class MessengerModule {}
