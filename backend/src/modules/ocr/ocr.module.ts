import { Module } from '@nestjs/common';
import { OCRService } from './ocr.service';
import { OCRController } from './ocr.controller';

@Module({
  providers: [OCRService],
  controllers: [OCRController],
  exports: [OCRService],
})
export class OCRModule {}
