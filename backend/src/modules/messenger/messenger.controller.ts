import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MessengerService } from './messenger.service';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../config/prisma.service';

@ApiTags('messenger')
@Controller()
export class MessengerController {
  constructor(
    private readonly messengerService: MessengerService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('messenger/webhook')
  @Public()
  @ApiOperation({ summary: 'Messenger webhook verification' })
  async verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const result = await this.messengerService.verifyWebhook(mode, token, challenge);
    if (result) return parseInt(result, 10);
    return 'Verification failed';
  }

  @Post('messenger/webhook')
  @Public()
  @ApiOperation({ summary: 'Messenger webhook events' })
  async handleWebhook(@Body() body: any) {
    if (body.object !== 'page') return;

    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        const eventId = event.message?.mid || `postback_${event.timestamp}`;

        const existing = await this.prisma.webhookEvent.findUnique({ where: { eventId } });
        if (existing?.processed) continue;

        await this.prisma.webhookEvent.create({
          data: {
            eventId,
            source: 'messenger',
            payload: event,
            processed: false,
          },
        });

        try {
          await this.messengerService.handleWebhookEvent(event);
          await this.prisma.webhookEvent.update({
            where: { eventId },
            data: { processed: true, processedAt: new Date() },
          });
        } catch (error) {
          console.error('Error processing webhook event:', error);
        }
      }
    }

    return 'EVENT_RECEIVED';
  }
}
