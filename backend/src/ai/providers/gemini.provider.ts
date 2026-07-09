import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  private currentApiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.currentApiKey = this.configService.get<string>('GEMINI_API_KEY', '');
  }

  setApiKey(apiKey: string): void {
    if (apiKey && apiKey !== this.currentApiKey) {
      this.currentApiKey = apiKey;
      this.logger.log('Gemini API key updated');
    }
  }

  private getConfig(): AIProviderConfig {
    return {
      apiKey: this.currentApiKey || this.configService.get<string>('GEMINI_API_KEY', ''),
      model: this.configService.get<string>('GEMINI_MODEL', 'gemini-2.5-flash'),
      temperature: parseFloat(this.configService.get<string>('GEMINI_TEMPERATURE', '0.3')),
      maxOutputTokens: parseInt(this.configService.get<string>('GEMINI_MAX_OUTPUT_TOKENS', '4096'), 10),
    };
  }

  async chat(messages: ChatMessage[], config?: Partial<AIProviderConfig>): Promise<ChatResponse> {
    const startTime = Date.now();
    const cfg = { ...this.getConfig(), ...config };

    if (!cfg.apiKey) {
      throw new Error('Gemini API key is not configured');
    }

    const systemInstruction = messages.find(m => m.role === 'system')?.content;
    const chatMessages = messages.filter(m => m.role !== 'system');

    const contents = chatMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body: Record<string, any> = { contents };
    if (systemInstruction) {
      body.system_instruction = { parts: [{ text: systemInstruction }] };
    }
    body.generationConfig = {
      temperature: cfg.temperature,
      maxOutputTokens: cfg.maxOutputTokens,
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data: any = await response.json();
    const lastResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    const latencyMs = Date.now() - startTime;

    return {
      text: lastResponse,
      tokensUsed: data?.usageMetadata?.promptTokenCount ?? 0,
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

    if (!cfg.apiKey) {
      throw new Error('Gemini API key is not configured');
    }

    const imageBase64 = imageBuffer.toString('base64');
    const body = {
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      }],
      generationConfig: {
        temperature: cfg.temperature,
        maxOutputTokens: cfg.maxOutputTokens,
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data: any = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    return {
      text,
      tokensUsed: data?.usageMetadata?.promptTokenCount ?? 0,
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
