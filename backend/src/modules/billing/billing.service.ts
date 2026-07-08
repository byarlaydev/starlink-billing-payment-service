import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { BillingStatus, PaymentMethod } from '@prisma/client';
import { generateRequestId } from '../../common/utils/file.util';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    customerId: string;
    fullName: string;
    facebookName?: string;
    contactNumber?: string;
    emailAddress?: string;
    starlinkEmail?: string;
    starlinkAccount?: string;
    billingAmount: number;
    billingMonth: string;
    preferredPayment?: PaymentMethod;
    additionalNotes?: string;
    idempotencyKey?: string;
  }) {
    if (data.idempotencyKey) {
      const existing = await this.prisma.billingRequest.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
      });
      if (existing) throw new ConflictException('Duplicate request');
    }

    const billingRequest = await this.prisma.billingRequest.create({
      data: {
        requestId: generateRequestId(),
        ...data,
        billingAmount: data.billingAmount,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        billingRequestId: billingRequest.id,
        actorId: data.customerId,
        actorType: 'customer',
        action: 'CREATE',
        description: `Billing request created: ${billingRequest.requestId}`,
      },
    });

    this.logger.log(`Billing request created: ${billingRequest.requestId}`);
    return billingRequest;
  }

  async findById(id: string) {
    const request = await this.prisma.billingRequest.findUnique({
      where: { id },
      include: {
        customer: true,
        paymentProofs: { include: { ocrResults: true } },
        activityLogs: { orderBy: { createdAt: 'desc' } },
        notifications: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!request) throw new NotFoundException('Billing request not found');
    return request;
  }

  async findByRequestId(requestId: string) {
    return this.prisma.billingRequest.findUnique({ where: { requestId } });
  }

  async findByCustomer(customerId: string, page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.prisma.billingRequest.findMany({
        where: { customerId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { paymentProofs: true },
      }),
      this.prisma.billingRequest.count({ where: { customerId } }),
    ]);
    return { data, total, page, limit };
  }

  async findAll(filter?: {
    status?: BillingStatus;
    page?: number;
    limit?: number;
    search?: string;
    billingMonth?: string;
  }) {
    const where: any = {};
    if (filter?.status) where.status = filter.status;
    if (filter?.billingMonth) where.billingMonth = filter.billingMonth;
    if (filter?.search) {
      where.OR = [
        { fullName: { contains: filter.search, mode: 'insensitive' } },
        { requestId: { contains: filter.search, mode: 'insensitive' } },
        { contactNumber: { contains: filter.search } },
        { emailAddress: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const page = filter?.page || 1;
    const limit = filter?.limit || 20;

    const [data, total] = await Promise.all([
      this.prisma.billingRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: true,
          paymentProofs: { include: { ocrResults: true } },
          _count: { select: { paymentProofs: true, activityLogs: true } },
        },
      }),
      this.prisma.billingRequest.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async updateStatus(id: string, status: BillingStatus, actorId?: string, actorType = 'admin') {
    const request = await this.prisma.billingRequest.update({
      where: { id },
      data: {
        status,
        resolvedAt: ['APPROVED', 'COMPLETED', 'REJECTED'].includes(status) ? new Date() : undefined,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        billingRequestId: id,
        actorId,
        actorType,
        action: status === 'APPROVED' ? 'APPROVE' : status === 'REJECTED' ? 'REJECT' : 'UPDATE',
        description: `Status changed to ${status}`,
      },
    });

    return request;
  }

  async getStats() {
    const [total, pending, processing, approved, completed, rejected, manualReview] = await Promise.all([
      this.prisma.billingRequest.count(),
      this.prisma.billingRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.billingRequest.count({ where: { status: 'PROCESSING' } }),
      this.prisma.billingRequest.count({ where: { status: 'APPROVED' } }),
      this.prisma.billingRequest.count({ where: { status: 'COMPLETED' } }),
      this.prisma.billingRequest.count({ where: { status: 'REJECTED' } }),
      this.prisma.billingRequest.count({ where: { status: 'MANUAL_REVIEW' } }),
    ]);

    return { total, pending, processing, approved, completed, rejected, manualReview };
  }

  async getAnalytics(start?: Date, end?: Date) {
    const dateFilter: any = {};
    if (start || end) {
      dateFilter.createdAt = {};
      if (start) dateFilter.createdAt.gte = start;
      if (end) dateFilter.createdAt.lte = end;
    }

    const monthlyData = await this.prisma.billingRequest.groupBy({
      by: ['billingMonth'],
      where: dateFilter,
      _count: true,
      _sum: { billingAmount: true },
    });

    const statusDistribution = await this.prisma.billingRequest.groupBy({
      by: ['status'],
      where: dateFilter,
      _count: true,
    });

    return { monthlyData, statusDistribution };
  }
}
