import { Controller, Post, Body, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role, Language } from '@prisma/client';
import { AIService } from '../../ai/ai.service';
import { SYSTEM_PROMPT, FAQ_PROMPT, HUMAN_RESPONSE_GUIDELINES } from '../../ai/prompts/system-prompts';

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
    const systemPrompt = SYSTEM_PROMPT + '\n\n' + FAQ_PROMPT + '\n\n' + HUMAN_RESPONSE_GUIDELINES;

    try {
      const response = await this.aiService.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: body.message },
        ],
        body.message,
        language,
      );
      return { success: true, data: response };
    } catch (error: any) {
      this.logger.error(`Chat failed: ${error.message}`);
      return { success: true, data: { text: `⚠️ AI Error: ${error.message}` } };
    }
  }
}
