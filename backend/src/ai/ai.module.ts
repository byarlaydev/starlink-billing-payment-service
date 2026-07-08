import { Module, Global } from '@nestjs/common';
import { AIService } from './ai.service';
import { GeminiProvider } from './providers/gemini.provider';
import { SettingsModule } from '../modules/settings/settings.module';

@Global()
@Module({
  imports: [SettingsModule],
  providers: [AIService, GeminiProvider],
  exports: [AIService, GeminiProvider],
})
export class AIModule {}
