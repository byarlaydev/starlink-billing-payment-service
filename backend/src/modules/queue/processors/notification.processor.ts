import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { TelegramService } from '../../telegram/telegram.service';
import { PrismaService } from '../../../config/prisma.service';

@Processor('notifications')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly prisma: PrismaService,
  ) {}

  @Process('new-billing-request')
  async handleNewBillingRequest(job: Job) {
    const { billingRequestId } = job.data;
    this.logger.log(`Sending notification for billing request ${billingRequestId}`);

    const request = await this.prisma.billingRequest.findUnique({
      where: { id: billingRequestId },
      include: {
        paymentProofs: { include: { ocrResults: true }, take: 1 },
      },
    });

    if (!request) return;

    const proof = request.paymentProofs[0];
    const ocr = proof?.ocrResults[0];

    await this.telegramService.notifyNewBillingRequest(request, proof, ocr);
  }

  @Process('status-change')
  async handleStatusChange(job: Job) {
    const { billingRequestId, newStatus } = job.data;

    const request = await this.prisma.billingRequest.findUnique({
      where: { id: billingRequestId },
    });

    if (!request) return;

    await this.telegramService.notifyStatusChange(request, newStatus);
  }

  @Process('manual-review')
  async handleManualReview(job: Job) {
    const { billingRequestId, ocrResultId } = job.data;

    const request = await this.prisma.billingRequest.findUnique({
      where: { id: billingRequestId },
    });

    const ocrResult = await this.prisma.oCRResult.findUnique({
      where: { id: ocrResultId },
    });

    if (!request || !ocrResult) return;

    await this.telegramService.notifyManualReview(request, ocrResult);
  }
}
