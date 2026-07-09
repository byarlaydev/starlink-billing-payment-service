import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { SettingsService } from '../modules/settings/settings.service';
import { MessagingService } from './messaging.service';
import { AIService } from '../ai/ai.service';

interface FollowUpDecision {
  action: 'reengage' | 'schedule' | 'close';
  message?: string;
  scheduleHours?: number;
  reason: string;
}

@Injectable()
export class AutoFollowUpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutoFollowUpService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastRunTime: Date | null = null;
  private lastStats = { reengaged: 0, scheduled: 0, closed: 0, skipped: 0 };

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly messagingService: MessagingService,
    private readonly aiService: AIService,
  ) {}

  async onModuleInit() {
    await this.startIfEnabled();
  }

  onModuleDestroy() {
    this.stop();
  }

  async startIfEnabled() {
    const enabled = await this.settingsService.get('messenger', 'auto_followup_enabled');
    if (enabled === 'true') {
      this.start();
    }
  }

  start() {
    if (this.intervalId) return;
    this.logger.log('Starting auto-followup service (checks every 5 minutes)');
    this.intervalId = setInterval(() => this.run(), 5 * 60 * 1000);
    this.run();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.log('Stopped auto-followup service');
    }
  }

  async restart() {
    this.stop();
    await this.startIfEnabled();
  }

  private async run() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const hoursStr = await this.settingsService.get('messenger', 'auto_followup_hours') || '24';
      const hours = parseInt(hoursStr, 10) || 24;
      const maxAttemptsStr = await this.settingsService.get('messenger', 'auto_followup_max_attempts') || '2';
      const maxAttempts = parseInt(maxAttemptsStr, 10) || 2;
      const instructions = await this.settingsService.get('messenger', 'auto_followup_instructions') || '';

      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

      const idleContexts = await this.prisma.conversationContext.findMany({
        where: {
          customer: {
            channel: { not: 'web_widget' },
            conversationState: { notIn: ['COMPLETED', 'ESCALATED'] },
            isActive: true,
            isAdminTakeover: false,
          },
          lastActiveAt: { lt: cutoff },
        },
        include: {
          customer: {
            include: {
              conversations: {
                orderBy: { createdAt: 'desc' },
                take: 15,
              },
            },
          },
        },
      });

      const dueContexts = await this.prisma.conversationContext.findMany({
        where: {
          customer: {
            channel: { not: 'web_widget' },
            conversationState: { notIn: ['COMPLETED', 'ESCALATED'] },
            isActive: true,
            isAdminTakeover: false,
          },
          scheduledFollowUpAt: { lte: new Date(), not: null },
        },
        include: {
          customer: {
            include: {
              conversations: {
                orderBy: { createdAt: 'desc' },
                take: 15,
              },
            },
          },
        },
      });

      this.lastStats = { reengaged: 0, scheduled: 0, closed: 0, skipped: 0 };

      const seen = new Set<string>();
      const toProcess = [...idleContexts, ...dueContexts];
      for (const ctx of toProcess) {
        if (seen.has(ctx.customerId)) continue;
        seen.add(ctx.customerId);

        try {
          if (ctx.followUpCount >= maxAttempts) {
            await this.closeConversation(ctx);
            this.lastStats.closed++;
            continue;
          }

          const decision = await this.analyzeConversation(ctx, instructions);
          await this.executeDecision(decision, ctx);

          if (decision.action === 'reengage') this.lastStats.reengaged++;
          else if (decision.action === 'schedule') this.lastStats.scheduled++;
          else if (decision.action === 'close') this.lastStats.closed++;
        } catch (error) {
          this.logger.error(`Failed to process follow-up for customer ${ctx.customerId}`, error);
        }
      }

      this.lastRunTime = new Date();

      const total = this.lastStats.reengaged + this.lastStats.scheduled + this.lastStats.closed;
      if (total > 0) {
        this.logger.log(`Auto-followup completed: ${this.lastStats.reengaged} reengaged, ${this.lastStats.scheduled} scheduled, ${this.lastStats.closed} closed`);
      }
    } catch (error) {
      this.logger.error('Auto-followup run failed', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async analyzeConversation(ctx: any, instructions: string): Promise<FollowUpDecision> {
    const customer = ctx.customer;
    const conversations = customer.conversations.slice().reverse();
    const firstName = (customer.fullName || customer.facebookName || '').split(' ')[0];

    const conversationSummary = conversations.map((c: any) => {
      const role = c.direction === 'inbound' ? 'Customer' : 'Bot';
      return `${role}: ${c.content.substring(0, 200)}`;
    }).join('\n');

    const inactiveHours = Math.floor(
      (Date.now() - new Date(ctx.lastActiveAt).getTime()) / (1000 * 60 * 60)
    );

    const prompt = `Analyze this idle customer conversation and decide the best follow-up action.

Customer: ${customer.fullName || customer.facebookName || 'Unknown'}
Language: ${customer.preferredLang}
Inactive for: ${inactiveHours} hours
Current state: ${customer.conversationState}
Follow-ups sent so far: ${ctx.followUpCount}

Recent conversation:
${conversationSummary}

${instructions ? `Business instructions:\n${instructions}\n` : ''}

Decide ONE action:
1. "reengage" - Send a friendly follow-up message to bring them back (use if they seemed interested but got distracted or had an unresolved issue)
2. "schedule" - Schedule a follow-up for later (use if timing might be better later, specify hours between 12-48)
3. "close" - Close the conversation (use if they seem disinterested, conversation is complete, or they never responded to previous follow-ups)

Respond in JSON format:
{
  "action": "reengage" | "schedule" | "close",
  "message": "the message to send (only for reengage)",
  "scheduleHours": 24,
  "reason": "brief explanation"
}

Guidelines:
- Be conversational and friendly, not robotic
- Reference their last topic if relevant
- Keep messages short (under 100 words)
- For "schedule", suggest 12-48 hours based on context
- For "close", only if conversation seems naturally complete or customer is clearly disengaged
- If they were in the middle of a billing flow, prefer reengage to help them complete it`;

    try {
      const response = await this.aiService.chat([
        { role: 'user', content: prompt },
      ]);

      const text = response.text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');

      const decision = JSON.parse(jsonMatch[0]) as FollowUpDecision;

      if (!['reengage', 'schedule', 'close'].includes(decision.action)) {
        throw new Error(`Invalid action: ${decision.action}`);
      }

      if (decision.action === 'reengage' && !decision.message) {
        decision.message = firstName
          ? `Hi ${firstName}! Just checking in - did you still need help with anything?`
          : `Hi! Just checking in - did you still need help with anything?`;
      }

      if (decision.action === 'schedule' && !decision.scheduleHours) {
        decision.scheduleHours = 24;
      }

      return decision;
    } catch (error) {
      this.logger.warn(`AI analysis failed for customer ${ctx.customerId}, defaulting to close`, error);
      return {
        action: 'close',
        reason: 'AI analysis failed, defaulting to close',
      };
    }
  }

  private async executeDecision(decision: FollowUpDecision, ctx: any) {
    if (decision.action === 'reengage') {
      const psid = ctx.customer.messengerPsid;
      if (psid && decision.message) {
        await this.messagingService.sendMessage(psid, decision.message);

        await this.prisma.messengerConversation.create({
          data: {
            customerId: ctx.customerId,
            direction: 'outbound',
            messageType: 'text',
            content: decision.message,
            metadata: { followUp: true, action: 'reengage', reason: decision.reason },
          },
        });
      }

      await this.prisma.conversationContext.update({
        where: { id: ctx.id },
        data: {
          lastActiveAt: new Date(),
          followUpCount: { increment: 1 },
          scheduledFollowUpAt: null,
        },
      });

      this.logger.log(`Reengaged customer ${ctx.customerId}: ${decision.reason}`);
    } else if (decision.action === 'schedule') {
      const scheduledTime = new Date(Date.now() + (decision.scheduleHours || 24) * 60 * 60 * 1000);

      await this.prisma.conversationContext.update({
        where: { id: ctx.id },
        data: {
          scheduledFollowUpAt: scheduledTime,
          followUpCount: { increment: 1 },
        },
      });

      this.logger.log(`Scheduled follow-up for customer ${ctx.customerId} at ${scheduledTime.toISOString()}: ${decision.reason}`);
    } else if (decision.action === 'close') {
      await this.closeConversation(ctx);
    }
  }

  private async closeConversation(ctx: any) {
    const customer = ctx.customer;
    const psid = customer.messengerPsid;
    const firstName = (customer.fullName || customer.facebookName || '').split(' ')[0];

    await this.prisma.customer.update({
      where: { id: ctx.customerId },
      data: { conversationState: 'COMPLETED' },
    });

    await this.prisma.conversationContext.update({
      where: { id: ctx.id },
      data: {
        sessionStep: 'greeting',
        collectedData: {},
        followUpCount: 0,
        scheduledFollowUpAt: null,
      },
    });

    if (psid) {
      const message = firstName
        ? `Hi ${firstName}! Just closing out our conversation since it's been a while. Feel free to message me anytime you need help with your Starlink billing. Have a great day!`
        : `Hi! Just closing out our conversation since it's been a while. Feel free to message me anytime you need help with your Starlink billing. Have a great day!`;

      await this.messagingService.sendMessage(psid, message);

      await this.prisma.messengerConversation.create({
        data: {
          customerId: ctx.customerId,
          direction: 'outbound',
          messageType: 'text',
          content: message,
          metadata: { followUp: true, action: 'close', reason: 'followup_close' },
        },
      });
    }

    this.logger.log(`Closed conversation for customer ${ctx.customerId}`);
  }

  async runNow() {
    await this.run();
    return {
      ...this.lastStats,
      lastRun: this.lastRunTime,
    };
  }

  getStatus() {
    return {
      lastRunTime: this.lastRunTime,
      lastStats: this.lastStats,
      isRunning: this.isRunning,
    };
  }
}
