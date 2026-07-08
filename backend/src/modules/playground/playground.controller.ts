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
    try {
      const language = body.language === 'MY' ? Language.MY : Language.EN;
      const systemPrompt = SYSTEM_PROMPT + '\n\n' + FAQ_PROMPT + '\n\n' + HUMAN_RESPONSE_GUIDELINES;

      // Test: check KB search first
      try {
        const kbResult = await this.aiService['buildKnowledgeContext'](body.message, language);
        this.logger.log(`KB search returned: ${kbResult ? 'non-empty' : 'empty'}`);
      } catch (kbErr: any) {
        this.logger.error(`KB search failed: ${kbErr.message}`, kbErr.stack);
      }

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
      this.logger.error(`Playground chat failed: ${error.message}`, error.stack);
      return { success: false, message: error.message, stack: error.stack?.split('\n').slice(0, 3).join('\n') };
    }
  }
}
