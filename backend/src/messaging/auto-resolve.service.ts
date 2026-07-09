import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { SettingsService } from '../modules/settings/settings.service';
import { MessagingService } from './messaging.service';

@Injectable()
export class AutoResolveService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutoResolveService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastRunTime: Date | null = null;
  private lastResolvedCount = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly messagingService: MessagingService,
  ) {}

  async onModuleInit() {
    await this.startIfEnabled();
  }

  onModuleDestroy() {
    this.stop();
  }

  async startIfEnabled() {
    const enabled = await this.settingsService.get('messenger', 'auto_resolve_enabled');
    if (enabled === 'true') {
      this.start();
    }
  }

  start() {
    if (this.intervalId) return;

    this.logger.log('Starting auto-resolve service (checks every 5 minutes)');
    this.intervalId = setInterval(() => this.run(), 5 * 60 * 1000);
    this.run();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.log('Stopped auto-resolve service');
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
      const hoursStr = await this.settingsService.get('messenger', 'auto_resolve_hours') || '24';
      const hours = parseInt(hoursStr, 10) || 24;
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

      const staleContexts = await this.prisma.conversationContext.findMany({
        where: {
          lastActiveAt: { lt: cutoff },
          customer: {
            conversationState: { not: 'COMPLETED' },
            isActive: true,
          },
        },
        include: { customer: true },
      });

      this.lastResolvedCount = 0;

      for (const ctx of staleContexts) {
        try {
          await this.prisma.customer.update({
            where: { id: ctx.customerId },
            data: { conversationState: 'COMPLETED' },
          });

          await this.prisma.conversationContext.update({
            where: { id: ctx.id },
            data: {
              sessionStep: 'greeting',
              collectedData: {},
            },
          });

          const psid = ctx.customer.messengerPsid;
          const firstName = (ctx.customer.fullName || ctx.customer.facebookName || '').split(' ')[0];

          if (psid) {
            const message = firstName
              ? `Hi ${firstName}! Just closing out our conversation since it's been a while. Feel free to message me anytime you need help with your Starlink billing. Have a great day!`
              : `Hi! Just closing out our conversation since it's been a while. Feel free to message me anytime you need help with your Starlink billing. Have a great day!`;

            await this.messagingService.sendMessage(psid, message);
          }

          this.lastResolvedCount++;
          this.logger.log(`Auto-resolved conversation for customer ${ctx.customerId} (inactive ${hours}h+)`);
        } catch (error) {
          this.logger.error(`Failed to auto-resolve customer ${ctx.customerId}`, error);
        }
      }

      this.lastRunTime = new Date();

      if (this.lastResolvedCount > 0) {
        this.logger.log(`Auto-resolve completed: ${this.lastResolvedCount} conversations closed`);
      }
    } catch (error) {
      this.logger.error('Auto-resolve run failed', error);
    } finally {
      this.isRunning = false;
    }
  }

  async runNow() {
    await this.run();
    return {
      resolved: this.lastResolvedCount,
      lastRun: this.lastRunTime,
    };
  }

  getStatus() {
    return {
      lastRunTime: this.lastRunTime,
      lastResolvedCount: this.lastResolvedCount,
      isRunning: this.isRunning,
    };
  }
}
