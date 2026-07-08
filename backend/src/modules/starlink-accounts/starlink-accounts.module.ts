import { Module } from '@nestjs/common';
import { StarlinkAccountsService } from './starlink-accounts.service';
import { StarlinkAccountsController } from './starlink-accounts.controller';

@Module({
  controllers: [StarlinkAccountsController],
  providers: [StarlinkAccountsService],
  exports: [StarlinkAccountsService],
})
export class StarlinkAccountsModule {}
