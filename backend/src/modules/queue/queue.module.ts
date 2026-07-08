import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QueueService } from './queue.service';
import { OCRProcessor } from './processors/ocr.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { AIProcessor } from './processors/ai.processor';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    BullModule.registerQueue(
      { name: 'ocr' },
      { name: 'notifications' },
      { name: 'ai' },
      { name: 'backups' },
    ),
  ],
  providers: [QueueService, OCRProcessor, NotificationProcessor, AIProcessor],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
