export interface AIProviderConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  text: string;
  tokensUsed: number;
  latencyMs: number;
  model: string;
}

export interface OCRResult {
  transactionId?: string;
  paymentDate?: string;
  paymentTime?: string;
  amountPaid?: number;
  paymentMethod?: string;
  senderName?: string;
  receiverName?: string;
  bankWalletName?: string;
  confidenceScore: number;
  rawText: string;
  needsManualReview: boolean;
}

export interface IntentResult {
  intent: string;
  confidence: number;
  entities: Record<string, string>;
  suggestedResponse?: string;
}

export interface AIProvider {
  readonly name: string;

  chat(messages: ChatMessage[], config?: Partial<AIProviderConfig>): Promise<ChatResponse>;

  analyzeDocument(
    imageBuffer: Buffer,
    mimeType: string,
    prompt: string,
    config?: Partial<AIProviderConfig>,
  ): Promise<{ text: string; tokensUsed: number; latencyMs: number; model: string }>;

  extractPaymentProof(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<OCRResult>;

  detectIntent(
    message: string,
    context?: string[],
  ): Promise<IntentResult>;
}
