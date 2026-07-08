import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OCRService } from './ocr.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('ocr')
@Controller('ocr')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OCRController {
  constructor(private readonly ocrService: OCRService) {}

  @Post('process/:paymentProofId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Manually trigger OCR processing' })
  async process(@Param('paymentProofId') paymentProofId: string) {
    return this.ocrService.processPaymentProof(paymentProofId);
  }

  @Get('payment-proof/:paymentProofId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get OCR results for a payment proof' })
  async getByPaymentProof(@Param('paymentProofId') paymentProofId: string) {
    return this.ocrService.getResultsByPaymentProof(paymentProofId);
  }

  @Get('manual-review')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get manual review queue' })
  async getManualReviewQueue(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.ocrService.getManualReviewQueue(page, limit);
  }

  @Get('confidence-distribution')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Get OCR confidence distribution' })
  async getConfidenceDistribution() {
    return this.ocrService.getConfidenceDistribution();
  }
}
