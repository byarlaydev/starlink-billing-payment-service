import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  providers: [TelegramService],
  controllers: [],
  exports: [TelegramService],
})
export class TelegramModule {}
