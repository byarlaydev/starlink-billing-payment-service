import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PaymentProofsService } from './payment-proofs.service';
import { PaymentProofsController } from './payment-proofs.controller';

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
      },
    }),
  ],
  providers: [PaymentProofsService],
  controllers: [PaymentProofsController],
  exports: [PaymentProofsService],
})
export class PaymentProofsModule {}
