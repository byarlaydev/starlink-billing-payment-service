import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProvider, AIProviderConfig, ChatMessage, ChatResponse, OCRResult, IntentResult } from './interfaces/ai-provider.interface';
import { GeminiProvider } from './providers/gemini.provider';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private currentProvider: AIProvider;

  constructor(
    private readonly configService: ConfigService,
    private readonly geminiProvider: GeminiProvider,
  ) {
    this.currentProvider = this.geminiProvider;
  }

  getProvider(): AIProvider {
    return this.currentProvider;
  }

  setProvider(provider: AIProvider): void {
    this.currentProvider = provider;
    this.logger.log(`AI provider switched to: ${provider.name}`);
  }

  getDefaultConfig(): AIProviderConfig {
    return {
      apiKey: this.configService.get<string>('GEMINI_API_KEY', ''),
      model: this.configService.get<string>('GEMINI_MODEL', 'gemini-2.5-flash'),
      temperature: parseFloat(this.configService.get<string>('GEMINI_TEMPERATURE', '0.3')),
      maxOutputTokens: parseInt(this.configService.get<string>('GEMINI_MAX_OUTPUT_TOKENS', '4096'), 10),
    };
  }

  async chat(messages: ChatMessage[]): Promise<ChatResponse> {
    return this.currentProvider.chat(messages);
  }

  async extractPaymentProof(imageBuffer: Buffer, mimeType: string): Promise<OCRResult> {
    return this.currentProvider.extractPaymentProof(imageBuffer, mimeType);
  }

  async detectIntent(message: string, context?: string[]): Promise<IntentResult> {
    return this.currentProvider.detectIntent(message, context);
  }

  async analyzeDocument(
    imageBuffer: Buffer,
    mimeType: string,
    prompt: string,
  ): Promise<{ text: string; tokensUsed: number; latencyMs: number; model: string }> {
    return this.currentProvider.analyzeDocument(imageBuffer, mimeType, prompt);
  }
}
