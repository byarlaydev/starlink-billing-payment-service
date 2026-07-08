import { Module, Global } from '@nestjs/common';
import { AIService } from './ai.service';
import { GeminiProvider } from './providers/gemini.provider';

@Global()
@Module({
  providers: [AIService, GeminiProvider],
  exports: [AIService, GeminiProvider],
})
export class AIModule {}
