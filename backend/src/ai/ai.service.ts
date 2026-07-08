import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProvider, AIProviderConfig, ChatMessage, ChatResponse, OCRResult, IntentResult } from './interfaces/ai-provider.interface';
import { GeminiProvider } from './providers/gemini.provider';
import { KnowledgeBaseService } from '../modules/knowledge-base/knowledge-base.service';
import { SettingsService } from '../modules/settings/settings.service';
import { Language } from '@prisma/client';
import { SYSTEM_PROMPT, FAQ_PROMPT, HUMAN_RESPONSE_GUIDELINES } from './prompts/system-prompts';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private currentProvider: AIProvider;

  constructor(
    private readonly configService: ConfigService,
    private readonly geminiProvider: GeminiProvider,
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly settingsService: SettingsService,
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

  private async loadDbConfig(): Promise<Partial<AIProviderConfig>> {
    try {
      const [apiKey, model, temperature, maxTokens] = await Promise.all([
        this.settingsService.getDecrypted('ai', 'gemini_api_key'),
        this.settingsService.get('ai', 'gemini_model'),
        this.settingsService.get('ai', 'temperature'),
        this.settingsService.get('ai', 'max_output_tokens'),
      ]);
      return {
        apiKey: apiKey || undefined,
        model: model || undefined,
        temperature: temperature ? parseFloat(temperature) : undefined,
        maxOutputTokens: maxTokens ? parseInt(maxTokens, 10) : undefined,
      };
    } catch (err) {
      this.logger.warn('Failed to load AI config from DB settings', err);
      return {};
    }
  }

  async getEffectiveConfig(): Promise<AIProviderConfig> {
    const envConfig = this.getDefaultConfig();
    const dbConfig = await this.loadDbConfig();
    return { ...envConfig, ...dbConfig };
  }

  getDefaultConfig(): AIProviderConfig {
    return {
      apiKey: this.configService.get<string>('GEMINI_API_KEY', ''),
      model: this.configService.get<string>('GEMINI_MODEL', 'gemini-2.5-flash'),
      temperature: parseFloat(this.configService.get<string>('GEMINI_TEMPERATURE', '0.3')),
      maxOutputTokens: parseInt(this.configService.get<string>('GEMINI_MAX_OUTPUT_TOKENS', '4096'), 10),
    };
  }

  private sanitizeForGemini(text: string): string {
    const chars: string[] = [];
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code > 255) {
        switch (code) {
          case 8226: case 8227: case 9702: chars.push('-'); break;
          case 8216: case 8217: chars.push("'"); break;
          case 8220: case 8221: chars.push('"'); break;
          case 8211: case 8212: chars.push('-'); break;
          default: chars.push(text[i]); break;
        }
      } else {
        chars.push(text[i]);
      }
    }
    return chars.join('');
  }

  async getEffectiveSystemPrompt(): Promise<string> {
    try {
      const customPrompt = await this.settingsService.get('ai', 'system_prompt');
      if (customPrompt) {
        return this.sanitizeForGemini(customPrompt) + '\n\n' + FAQ_PROMPT + '\n\n' + HUMAN_RESPONSE_GUIDELINES;
      }
    } catch (err) {
      this.logger.warn('Failed to load system prompt from DB settings', err);
    }
    return SYSTEM_PROMPT + '\n\n' + FAQ_PROMPT + '\n\n' + HUMAN_RESPONSE_GUIDELINES;
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
        messages[0].content += this.sanitizeForGemini(knowledgeContext);
      }
    }
    
    const sanitized = messages.map(m => ({
      ...m,
      content: this.sanitizeForGemini(m.content),
    }));

    const config = await this.getEffectiveConfig();
    if (config.apiKey) {
      this.geminiProvider.setApiKey(config.apiKey);
    }
    return this.currentProvider.chat(sanitized, config);
  }

  async extractPaymentProof(imageBuffer: Buffer, mimeType: string): Promise<OCRResult> {
    return this.currentProvider.extractPaymentProof(imageBuffer, mimeType);
  }

  async detectIntent(message: string, context?: string[]): Promise<IntentResult> {
    const config = await this.getEffectiveConfig();
    if (config.apiKey) {
      this.geminiProvider.setApiKey(config.apiKey);
    }
    return this.currentProvider.detectIntent(this.sanitizeForGemini(message), context);
  }

  async analyzeDocument(
    imageBuffer: Buffer,
    mimeType: string,
    prompt: string,
  ): Promise<{ text: string; tokensUsed: number; latencyMs: number; model: string }> {
    return this.currentProvider.analyzeDocument(imageBuffer, mimeType, prompt);
  }
}
