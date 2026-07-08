import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';

@Module({
  providers: [TelegramService],
  controllers: [],
  exports: [TelegramService],
})
export class TelegramModule {}
