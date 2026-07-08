import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AIService } from '../../ai/ai.service';
import { OCRConfidence } from '@prisma/client';

@Injectable()
export class OCRService {
  private readonly logger = new Logger(OCRService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  async processPaymentProof(paymentProofId: string) {
    this.logger.log(`Processing OCR for payment proof: ${paymentProofId}`);

    const proof = await this.prisma.paymentProof.findUnique({ where: { id: paymentProofId } });
    if (!proof) throw new Error(`Payment proof not found: ${paymentProofId}`);

    const fs = await import('fs');
    const buffer = fs.readFileSync(proof.filePath);

    const startTime = Date.now();
    const ocrResult = await this.aiService.extractPaymentProof(buffer, proof.mimeType);
    const latencyMs = Date.now() - startTime;

    const confidenceLevel = this.mapConfidenceLevel(ocrResult.confidenceScore);

    const saved = await this.prisma.oCRResult.create({
      data: {
        paymentProofId,
        transactionId: ocrResult.transactionId,
        paymentDate: ocrResult.paymentDate,
        paymentTime: ocrResult.paymentTime,
        amountPaid: ocrResult.amountPaid,
        paymentMethod: ocrResult.paymentMethod,
        senderName: ocrResult.senderName,
        receiverName: ocrResult.receiverName,
        bankWalletName: ocrResult.bankWalletName,
        confidenceScore: ocrResult.confidenceScore,
        confidenceLevel,
        rawText: ocrResult.rawText,
        aiModel: this.aiService.getProvider().name,
        aiRawResponse: ocrResult.rawText,
        needsManualReview: ocrResult.needsManualReview,
      },
    });

    await this.prisma.aIResponse.create({
      data: {
        ocrResultId: saved.id,
        promptUsed: 'payment_proof_extraction',
        responseText: ocrResult.rawText,
        modelUsed: this.aiService.getProvider().name,
        latencyMs,
        confidenceScore: ocrResult.confidenceScore,
        metadata: { paymentProofId, needsManualReview: ocrResult.needsManualReview },
      },
    });

    if (ocrResult.needsManualReview) {
      await this.prisma.billingRequest.update({
        where: { id: proof.billingRequestId },
        data: { status: 'MANUAL_REVIEW' },
      });

      await this.prisma.activityLog.create({
        data: {
          billingRequestId: proof.billingRequestId,
          actorType: 'ai',
          action: 'ESCALATE',
          description: `OCR confidence low (${ocrResult.confidenceScore}). Flagged for manual review.`,
        },
      });
    }

    this.logger.log(`OCR complete for ${paymentProofId}. Confidence: ${ocrResult.confidenceScore}`);
    return saved;
  }

  private mapConfidenceLevel(score: number): OCRConfidence {
    if (score >= 0.9) return OCRConfidence.HIGH;
    if (score >= 0.7) return OCRConfidence.MEDIUM;
    if (score >= 0.5) return OCRConfidence.LOW;
    return OCRConfidence.NONE;
  }

  async getResultsByPaymentProof(paymentProofId: string) {
    return this.prisma.oCRResult.findMany({
      where: { paymentProofId },
      orderBy: { processedAt: 'desc' },
    });
  }

  async getManualReviewQueue(page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.prisma.oCRResult.findMany({
        where: { needsManualReview: true },
        include: {
          paymentProof: {
            include: { billingRequest: { include: { customer: true } } },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { processedAt: 'desc' },
      }),
      this.prisma.oCRResult.count({ where: { needsManualReview: true } }),
    ]);
    return { data, total, page, limit };
  }

  async getConfidenceDistribution() {
    const results = await this.prisma.oCRResult.groupBy({
      by: ['confidenceLevel'],
      _count: true,
    });
    return results;
  }
}
