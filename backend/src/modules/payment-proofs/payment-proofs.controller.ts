import {
  Controller, Get, Post, Param, UploadedFile, UseInterceptors, UseGuards, Query, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { PaymentProofsService } from './payment-proofs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { Response } from 'express';

@ApiTags('payment-proofs')
@Controller('payment-proofs')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PaymentProofsController {
  constructor(private readonly paymentProofsService: PaymentProofsService) {}

  @Post('upload/:billingRequestId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload payment proof for a billing request' })
  async upload(
    @Param('billingRequestId') billingRequestId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.paymentProofsService.upload(billingRequestId, file);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR, Role.VIEWER)
  @ApiOperation({ summary: 'Get payment proof details' })
  async findById(@Param('id') id: string) {
    return this.paymentProofsService.findById(id);
  }

  @Get(':id/file')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR, Role.VIEWER)
  @ApiOperation({ summary: 'Download payment proof file' })
  async downloadFile(@Param('id') id: string, @Res() res: Response) {
    const { buffer, mimeType, filename } = await this.paymentProofsService.getFileBuffer(id);
    res.set({ 'Content-Type': mimeType, 'Content-Disposition': `inline; filename="${filename}"` });
    res.send(buffer);
  }

  @Get('request/:billingRequestId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR, Role.VIEWER)
  @ApiOperation({ summary: 'Get all payment proofs for a billing request' })
  async findByBillingRequest(@Param('billingRequestId') billingRequestId: string) {
    return this.paymentProofsService.findByBillingRequest(billingRequestId);
  }
}
