import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { AIService } from '../../../ai/ai.service';
import { PrismaService } from '../../../config/prisma.service';

@Processor('ai')
export class AIProcessor {
  private readonly logger = new Logger(AIProcessor.name);

  constructor(
    private readonly aiService: AIService,
    private readonly prisma: PrismaService,
  ) {}

  @Process('generate-summary')
  async handleGenerateSummary(job: Job) {
    const { billingRequestId } = job.data;
    this.logger.log(`Generating summary for request ${billingRequestId}`);

    const request = await this.prisma.billingRequest.findUnique({
      where: { id: billingRequestId },
      include: {
        customer: { include: { conversations: { take: 20, orderBy: { createdAt: 'desc' } } } },
        paymentProofs: { include: { ocrResults: true } },
      },
    });

    if (!request) return;

    const conversationSummary = request.customer.conversations
      .filter(c => c.direction === 'inbound')
      .map(c => c.content)
      .join('\n');

    const response = await this.aiService.chat([
      { role: 'system', content: 'Summarize this customer billing conversation in 2-3 sentences.' },
      { role: 'user', content: conversationSummary || 'No conversation history' },
    ]);

    await this.prisma.aIResponse.create({
      data: {
        promptUsed: 'conversation_summary',
        responseText: response.text,
        modelUsed: response.model,
        tokensUsed: response.tokensUsed,
        latencyMs: response.latencyMs,
        metadata: { billingRequestId, type: 'summary' },
      },
    });

    return response.text;
  }

  @Process('validate-data')
  async handleValidateData(job: Job) {
    const { billingRequestId } = job.data;

    const request = await this.prisma.billingRequest.findUnique({
      where: { id: billingRequestId },
      include: { paymentProofs: { include: { ocrResults: true } } },
    });

    if (!request) return;

    const response = await this.aiService.chat([
      {
        role: 'system',
        content: 'Validate the billing data. Check if amounts match, dates are valid, and all required fields are present. Return JSON with { valid: boolean, issues: string[] }',
      },
      {
        role: 'user',
        content: JSON.stringify({
          billingAmount: request.billingAmount.toString(),
          ocrAmount: request.paymentProofs[0]?.ocrResults[0]?.amountPaid?.toString(),
          customerEmail: request.emailAddress,
          starlinkEmail: request.starlinkEmail,
        }),
      },
    ]);

    return response.text;
  }
}
