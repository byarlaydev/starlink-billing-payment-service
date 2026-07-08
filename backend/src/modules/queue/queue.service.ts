import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('ocr') private readonly ocrQueue: Queue,
    @InjectQueue('notifications') private readonly notificationQueue: Queue,
    @InjectQueue('ai') private readonly aiQueue: Queue,
    @InjectQueue('backups') private readonly backupQueue: Queue,
  ) {}

  async addOCRJob(paymentProofId: string) {
    const job = await this.ocrQueue.add('process-payment-proof', { paymentProofId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
    });
    this.logger.log(`OCR job added: ${job.id} for proof ${paymentProofId}`);
    return job;
  }

  async addNotificationJob(type: string, data: any) {
    const job = await this.notificationQueue.add(type, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
    });
    this.logger.log(`Notification job added: ${job.id} type ${type}`);
    return job;
  }

  async addAIJob(type: string, data: any) {
    const job = await this.aiQueue.add(type, data, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: true,
    });
    return job;
  }

  async addBackupJob() {
    const job = await this.backupQueue.add('run-backup', {}, {
      attempts: 1,
      removeOnComplete: true,
    });
    return job;
  }

  async getQueueStats() {
    const [ocr, notifications, ai] = await Promise.all([
      this.ocrQueue.getJobCounts(),
      this.notificationQueue.getJobCounts(),
      this.aiQueue.getJobCounts(),
    ]);
    return { ocr, notifications, ai };
  }
}
