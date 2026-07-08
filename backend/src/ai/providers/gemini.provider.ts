import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  AIProvider,
  AIProviderConfig,
  ChatMessage,
  ChatResponse,
  OCRResult,
  IntentResult,
} from '../interfaces/ai-provider.interface';
import { PAYMENT_PROOF_EXTRACTION_PROMPT, INTENT_DETECTION_PROMPT } from '../prompts/system-prompts';

@Injectable()
export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  private readonly logger = new Logger(GeminiProvider.name);
  private genAI: GoogleGenerativeAI;
  private currentApiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.currentApiKey = this.configService.get<string>('GEMINI_API_KEY', '');
    this.genAI = new GoogleGenerativeAI(this.currentApiKey);
  }

  setApiKey(apiKey: string): void {
    if (apiKey && apiKey !== this.currentApiKey) {
      this.currentApiKey = apiKey;
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.logger.log('Gemini API key updated');
    }
  }

  private getConfig(): AIProviderConfig {
    return {
      apiKey: this.configService.get<string>('GEMINI_API_KEY', ''),
      model: this.configService.get<string>('GEMINI_MODEL', 'gemini-2.5-flash'),
      temperature: parseFloat(this.configService.get<string>('GEMINI_TEMPERATURE', '0.3')),
      maxOutputTokens: parseInt(this.configService.get<string>('GEMINI_MAX_OUTPUT_TOKENS', '4096'), 10),
    };
  }

  async chat(messages: ChatMessage[], config?: Partial<AIProviderConfig>): Promise<ChatResponse> {
    const startTime = Date.now();
    const cfg = { ...this.getConfig(), ...config };

    const model = this.genAI.getGenerativeModel({
      model: cfg.model,
      generationConfig: {
        temperature: cfg.temperature,
        maxOutputTokens: cfg.maxOutputTokens,
      },
    });

    const systemInstruction = messages.find(m => m.role === 'system')?.content;
    const chatMessages = messages.filter(m => m.role !== 'system');

    const chat = model.startChat({
      history: systemInstruction
        ? [{ role: 'user', parts: [{ text: systemInstruction }] }, { role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] }]
        : [],
    });

    let lastResponse = '';
    for (const msg of chatMessages) {
      const result = await chat.sendMessage(msg.content);
      lastResponse = result.response.text();
    }

    const latencyMs = Date.now() - startTime;

    return {
      text: lastResponse,
      tokensUsed: 0,
      latencyMs,
      model: cfg.model,
    };
  }

  async analyzeDocument(
    imageBuffer: Buffer,
    mimeType: string,
    prompt: string,
    config?: Partial<AIProviderConfig>,
  ): Promise<{ text: string; tokensUsed: number; latencyMs: number; model: string }> {
    const startTime = Date.now();
    const cfg = { ...this.getConfig(), ...config };

    const model = this.genAI.getGenerativeModel({
      model: cfg.model,
      generationConfig: {
        temperature: cfg.temperature,
        maxOutputTokens: cfg.maxOutputTokens,
      },
    });

    const imageBase64 = imageBuffer.toString('base64');
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: imageBase64, mimeType } },
    ]);

    return {
      text: result.response.text(),
      tokensUsed: 0,
      latencyMs: Date.now() - startTime,
      model: cfg.model,
    };
  }

  async extractPaymentProof(imageBuffer: Buffer, mimeType: string): Promise<OCRResult> {
    try {
      const result = await this.analyzeDocument(
        imageBuffer,
        mimeType,
        PAYMENT_PROOF_EXTRACTION_PROMPT,
      );

      const parsed = this.parseOCRResponse(result.text);

      return {
        ...parsed,
        rawText: result.text,
        needsManualReview: parsed.confidenceScore < 0.7,
      };
    } catch (error) {
      this.logger.error('Failed to extract payment proof', error);
      return {
        confidenceScore: 0,
        rawText: '',
        needsManualReview: true,
      };
    }
  }

  async detectIntent(message: string, context?: string[]): Promise<IntentResult> {
    try {
      const contextStr = context?.length
        ? `\n\nRecent conversation context:\n${context.join('\n')}`
        : '';

      const response = await this.chat([
        { role: 'system', content: INTENT_DETECTION_PROMPT + contextStr },
        { role: 'user', content: message },
      ]);

      return this.parseIntentResponse(response.text);
    } catch (error) {
      this.logger.error('Failed to detect intent', error);
      return {
        intent: 'unknown',
        confidence: 0,
        entities: {},
      };
    }
  }

  private parseOCRResponse(text: string): Omit<OCRResult, 'rawText' | 'needsManualReview'> {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          transactionId: parsed.transaction_id || parsed.transactionId || null,
          paymentDate: parsed.payment_date || parsed.paymentDate || null,
          paymentTime: parsed.payment_time || parsed.paymentTime || null,
          amountPaid: parsed.amount_paid || parsed.amountPaid ? parseFloat(parsed.amount_paid || parsed.amountPaid) : undefined,
          paymentMethod: parsed.payment_method || parsed.paymentMethod || null,
          senderName: parsed.sender_name || parsed.senderName || null,
          receiverName: parsed.receiver_name || parsed.receiverName || null,
          bankWalletName: parsed.bank_wallet_name || parsed.bankWalletName || null,
          confidenceScore: parsed.confidence_score || parsed.confidenceScore || 0,
        };
      }
    } catch {
      this.logger.warn('Could not parse OCR response as JSON');
    }

    return {
      confidenceScore: 0.1,
    };
  }

  private parseIntentResponse(text: string): IntentResult {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          intent: parsed.intent || 'unknown',
          confidence: parsed.confidence || 0,
          entities: parsed.entities || {},
          suggestedResponse: parsed.suggested_response || parsed.suggestedResponse,
        };
      }
    } catch {
      this.logger.warn('Could not parse intent response as JSON');
    }

    return {
      intent: 'unknown',
      confidence: 0,
      entities: {},
    };
  }
}
