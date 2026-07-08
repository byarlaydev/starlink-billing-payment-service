import { Controller, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role, Language } from '@prisma/client';
import { AIService } from '../../ai/ai.service';

@ApiTags('playground')
@Controller('playground')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PlaygroundController {
  private readonly logger = new Logger(PlaygroundController.name);

  constructor(private readonly aiService: AIService) {}

  @Post('chat')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Send a message to the AI bot playground' })
  async chat(@Body() body: { message: string; language?: 'EN' | 'MY' }) {
    const language = body.language === 'MY' ? Language.MY : Language.EN;
    const systemPrompt = await this.aiService.getEffectiveSystemPrompt();

    try {
      this.logger.log(`System prompt length=${systemPrompt.length}, first 50 chars="${systemPrompt.substring(0, 50)}"`);
      const response = await this.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: body.message },
        ],
        body.message,
        language,
      );
      return response;
    } catch (error: any) {
      this.logger.error(`Chat failed: ${error.message}`);
      this.logger.error(`Stack: ${error.stack}`);
      return {
        text: `⚠️ AI Error: ${error.message}`,
        debug: {
          systemPromptLength: systemPrompt.length,
          systemPromptFirst50: systemPrompt.substring(0, 50),
          systemPromptCodes: [...systemPrompt.substring(0, 10)].map(c => c.charCodeAt(0)),
        },
      };
    }
  }
}
