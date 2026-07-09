import { Module, Global } from '@nestjs/common';
import { FacebookMessagingProvider } from './providers/facebook.provider';
import { InventMessagingProvider } from './providers/invent.provider';
import { InventPollingService } from './invent-polling.service';
import { AutoResolveService } from './auto-resolve.service';
import { MessagingService } from './messaging.service';
import { SettingsModule } from '../modules/settings/settings.module';

@Global()
@Module({
  imports: [SettingsModule],
  providers: [
    FacebookMessagingProvider,
    InventMessagingProvider,
    InventPollingService,
    AutoResolveService,
    MessagingService,
  ],
  exports: [MessagingService, InventPollingService, AutoResolveService],
})
export class MessagingModule {}
