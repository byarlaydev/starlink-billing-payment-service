import { Module } from '@nestjs/common';
import { MessengerService } from './messenger.service';
import { MessengerController } from './messenger.controller';
import { MessengerConversationService } from './messenger-conversation.service';

@Module({
  providers: [MessengerService, MessengerConversationService],
  controllers: [MessengerController],
  exports: [MessengerService, MessengerConversationService],
})
export class MessengerModule {}
