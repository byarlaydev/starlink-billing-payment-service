import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './config/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { BillingModule } from './modules/billing/billing.module';
import { PaymentProofsModule } from './modules/payment-proofs/payment-proofs.module';
import { OCRModule } from './modules/ocr/ocr.module';
import { MessengerModule } from './modules/messenger/messenger.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { SettingsModule } from './modules/settings/settings.module';
import { QueueModule } from './modules/queue/queue.module';
import { HealthModule } from './modules/health/health.module';
import { AdminModule } from './modules/admin/admin.module';
import { AIModule } from './ai/ai.module';
import { KnowledgeBaseModule } from './modules/knowledge-base/knowledge-base.module';
import { StarlinkAccountsModule } from './modules/starlink-accounts/starlink-accounts.module';
import { RegionPlanModule } from './modules/region-plan/region-plan.module';
import { PlaygroundModule } from './modules/playground/playground.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([{
      ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
      limit: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    }]),
    PrismaModule,
    AIModule,
    AuthModule,
    CustomersModule,
    BillingModule,
    PaymentProofsModule,
    OCRModule,
    MessengerModule,
    TelegramModule,
    SettingsModule,
    QueueModule,
    HealthModule,
    AdminModule,
    KnowledgeBaseModule,
    StarlinkAccountsModule,
    RegionPlanModule,
    PlaygroundModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
