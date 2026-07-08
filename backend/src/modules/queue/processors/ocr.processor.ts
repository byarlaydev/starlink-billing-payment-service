import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { OCRService } from '../../ocr/ocr.service';

@Processor('ocr')
export class OCRProcessor {
  private readonly logger = new Logger(OCRProcessor.name);

  constructor(private readonly ocrService: OCRService) {}

  @Process('process-payment-proof')
  async handlePaymentProof(job: Job) {
    const { paymentProofId } = job.data;
    this.logger.log(`Processing OCR job ${job.id} for proof ${paymentProofId}`);

    try {
      const result = await this.ocrService.processPaymentProof(paymentProofId);
      this.logger.log(`OCR job ${job.id} completed. Confidence: ${result.confidenceScore}`);
      return result;
    } catch (error) {
      this.logger.error(`OCR job ${job.id} failed`, error);
      throw error;
    }
  }
}
