import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QueueService } from './queue.service';
import { OCRProcessor } from './processors/ocr.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { AIProcessor } from './processors/ai.processor';
import { OCRModule } from '../ocr/ocr.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AIModule } from '../../ai/ai.module';

function getRedisConfig() {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      password: url.password || undefined,
      username: url.username || undefined,
    };
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  };
}

@Module({
  imports: [
    BullModule.forRoot({
      redis: getRedisConfig(),
    }),
    BullModule.registerQueue(
      { name: 'ocr' },
      { name: 'notifications' },
      { name: 'ai' },
      { name: 'backups' },
    ),
    OCRModule,
    TelegramModule,
    AIModule,
  ],
  providers: [QueueService, OCRProcessor, NotificationProcessor, AIProcessor],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
