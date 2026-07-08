import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProvider, AIProviderConfig, ChatMessage, ChatResponse, OCRResult, IntentResult } from './interfaces/ai-provider.interface';
import { GeminiProvider } from './providers/gemini.provider';
import { KnowledgeBaseService } from '../modules/knowledge-base/knowledge-base.service';
import { Language } from '@prisma/client';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private currentProvider: AIProvider;

  constructor(
    private readonly configService: ConfigService,
    private readonly geminiProvider: GeminiProvider,
    private readonly knowledgeBaseService: KnowledgeBaseService,
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

  async buildKnowledgeContext(query: string, language: Language = Language.EN): Promise<string> {
    const relevantEntries = await this.knowledgeBaseService.searchForAI(query, language, 5);
    
    if (relevantEntries.length === 0) {
      return '';
    }

    const context = relevantEntries.map(entry => {
      return `[${entry.category}] ${entry.title}\n${entry.content}`;
    }).join('\n\n');

    return `\n\nRelevant Knowledge Base:\n${context}`;
  }

  async chat(messages: ChatMessage[], knowledgeQuery?: string, language?: Language): Promise<ChatResponse> {
    if (knowledgeQuery) {
      const knowledgeContext = await this.buildKnowledgeContext(knowledgeQuery, language);
      if (knowledgeContext && messages.length > 0 && messages[0].role === 'system') {
        messages[0].content += knowledgeContext;
      }
    }
    
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
