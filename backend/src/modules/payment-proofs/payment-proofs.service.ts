import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { generateUniqueFilename } from '../../common/utils/file.util';
import { generateChecksum } from '../../common/utils/encryption.util';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PaymentProofsService {
  private readonly logger = new Logger(PaymentProofsService.name);
  private readonly uploadDir: string;
  private readonly allowedTypes: string[];

  constructor(private readonly prisma: PrismaService) {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/png,image/jpeg,application/pdf').split(',');

    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async upload(billingRequestId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');

    if (!this.allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(`File type not allowed: ${file.mimetype}`);
    }

    const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10);
    if (file.size > maxSize) {
      throw new BadRequestException(`File too large. Max: ${maxSize / 1024 / 1024}MB`);
    }

    const storedFilename = generateUniqueFilename(file.originalname);
    const filePath = path.join(this.uploadDir, storedFilename);
    const checksum = generateChecksum(file.buffer);

    fs.writeFileSync(filePath, file.buffer);

    const paymentProof = await this.prisma.paymentProof.create({
      data: {
        billingRequestId,
        originalFilename: file.originalname,
        storedFilename,
        filePath,
        fileSize: file.size,
        mimeType: file.mimetype,
        checksum,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        billingRequestId,
        actorType: 'system',
        action: 'CREATE',
        description: `Payment proof uploaded: ${file.originalname}`,
        metadata: { fileSize: file.size, mimeType: file.mimetype },
      },
    });

    this.logger.log(`Payment proof uploaded: ${storedFilename} for request ${billingRequestId}`);
    return paymentProof;
  }

  async findById(id: string) {
    const proof = await this.prisma.paymentProof.findUnique({
      where: { id },
      include: { ocrResults: true },
    });
    if (!proof) throw new NotFoundException('Payment proof not found');
    return proof;
  }

  async findByBillingRequest(billingRequestId: string) {
    return this.prisma.paymentProof.findMany({
      where: { billingRequestId },
      include: { ocrResults: true },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async getFileBuffer(id: string): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    const proof = await this.findById(id);
    const buffer = fs.readFileSync(proof.filePath);
    return { buffer, mimeType: proof.mimeType, filename: proof.originalFilename };
  }

  async markVirusScanStatus(id: string, status: string) {
    return this.prisma.paymentProof.update({
      where: { id },
      data: { virusScanStatus: status },
    });
  }
}
