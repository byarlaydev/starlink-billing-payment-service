import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { ConversationState, Language, DataReviewStatus } from '@prisma/client';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByPsid(psid: string) {
    return this.prisma.customer.findUnique({ where: { messengerPsid: psid } });
  }

  async findOrCreate(psid: string, facebookName?: string) {
    let customer = await this.findByPsid(psid);
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          messengerPsid: psid,
          facebookName: facebookName || null,
          dataCollectedBy: 'bot',
          reviewStatus: 'PENDING_REVIEW',
        },
      });
      await this.prisma.conversationContext.create({
        data: { customerId: customer.id },
      });
      this.logger.log(`New customer created: ${psid}`);
    } else if (facebookName && !customer.facebookName) {
      customer = await this.prisma.customer.update({
        where: { id: customer.id },
        data: { facebookName },
      });
    }
    return customer;
  }

  async update(customerId: string, data: {
    fullName?: string;
    contactNumber?: string;
    emailAddress?: string;
    starlinkEmail?: string;
    starlinkAccount?: string;
    preferredLang?: Language;
    conversationState?: ConversationState;
    isAdminTakeover?: boolean;
    takeoverAdminId?: string;
  }) {
    return this.prisma.customer.update({ where: { id: customerId }, data });
  }

  async findById(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        billingRequests: { orderBy: { createdAt: 'desc' }, take: 10 },
        conversationContext: true,
        starlinkAccounts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async findAll(filter?: {
    page?: number;
    limit?: number;
    search?: string;
    reviewStatus?: DataReviewStatus;
  }) {
    const where: any = {};
    if (filter?.reviewStatus) where.reviewStatus = filter.reviewStatus;
    if (filter?.search) {
      where.OR = [
        { fullName: { contains: filter.search, mode: 'insensitive' } },
        { facebookName: { contains: filter.search, mode: 'insensitive' } },
        { contactNumber: { contains: filter.search } },
        { emailAddress: { contains: filter.search, mode: 'insensitive' } },
        { messengerPsid: { contains: filter.search } },
        { starlinkEmail: { contains: filter.search, mode: 'insensitive' } },
        { starlinkAccount: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const page = filter?.page || 1;
    const limit = filter?.limit || 20;

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { billingRequests: true, conversations: true, starlinkAccounts: true } },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findPendingReview(page = 1, limit = 20) {
    return this.findAll({ page, limit, reviewStatus: 'PENDING_REVIEW' });
  }

  async adminCreate(data: {
    messengerPsid?: string;
    fullName: string;
    facebookName?: string;
    contactNumber?: string;
    emailAddress?: string;
    starlinkEmail?: string;
    starlinkAccount?: string;
    preferredLang?: Language;
    adminId: string;
  }) {
    const customer = await this.prisma.customer.create({
      data: {
        messengerPsid: data.messengerPsid || `ADMIN_${Date.now()}`,
        fullName: data.fullName,
        facebookName: data.facebookName,
        contactNumber: data.contactNumber,
        emailAddress: data.emailAddress,
        starlinkEmail: data.starlinkEmail,
        starlinkAccount: data.starlinkAccount,
        preferredLang: data.preferredLang || Language.EN,
        dataCollectedBy: 'admin',
        reviewStatus: 'APPROVED',
        reviewedBy: data.adminId,
        reviewedAt: new Date(),
      },
    });

    await this.prisma.conversationContext.create({
      data: { customerId: customer.id },
    });

    // Create Starlink account if email provided
    if (data.starlinkEmail) {
      await this.prisma.starlinkAccount.create({
        data: {
          customerId: customer.id,
          email: data.starlinkEmail,
          accountNumber: data.starlinkAccount,
          isPrimary: true,
        },
      });
    }

    await this.prisma.activityLog.create({
      data: {
        actorId: data.adminId,
        actorType: 'admin',
        action: 'CREATE',
        description: `Customer created by admin: ${data.fullName}`,
        metadata: { customerId: customer.id },
      },
    });

    return customer;
  }

  async adminUpdate(customerId: string, data: {
    fullName?: string;
    facebookName?: string;
    contactNumber?: string;
    emailAddress?: string;
    starlinkEmail?: string;
    starlinkAccount?: string;
    preferredLang?: Language;
    adminId: string;
  }) {
    const customer = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        fullName: data.fullName,
        facebookName: data.facebookName,
        contactNumber: data.contactNumber,
        emailAddress: data.emailAddress,
        starlinkEmail: data.starlinkEmail,
        starlinkAccount: data.starlinkAccount,
        preferredLang: data.preferredLang,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        actorId: data.adminId,
        actorType: 'admin',
        action: 'UPDATE',
        description: `Customer updated by admin: ${customer.fullName}`,
        metadata: { customerId, changes: data },
      },
    });

    return customer;
  }

  async reviewCustomer(customerId: string, data: {
    reviewStatus: DataReviewStatus;
    adminId: string;
    reviewNotes?: string;
  }) {
    const customer = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        reviewStatus: data.reviewStatus,
        reviewedBy: data.adminId,
        reviewedAt: new Date(),
        reviewNotes: data.reviewNotes,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        actorId: data.adminId,
        actorType: 'admin',
        action: data.reviewStatus === 'APPROVED' ? 'APPROVE' : 'REJECT',
        description: `Customer review: ${data.reviewStatus} - ${customer.fullName}`,
        metadata: { customerId, reviewStatus: data.reviewStatus, reviewNotes: data.reviewNotes },
      },
    });

    return customer;
  }

  async takeOverConversation(customerId: string, adminId: string) {
    return this.prisma.customer.update({
      where: { id: customerId },
      data: {
        isAdminTakeover: true,
        takeoverAdminId: adminId,
        conversationState: 'ESCALATED',
      },
    });
  }

  async releaseTakeover(customerId: string) {
    return this.prisma.customer.update({
      where: { id: customerId },
      data: {
        isAdminTakeover: false,
        takeoverAdminId: null,
        conversationState: 'IDLE',
      },
    });
  }

  async getConversations(customerId: string, limit = 50) {
    return this.prisma.messengerConversation.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async addConversation(customerId: string, data: {
    direction: string;
    messageType: string;
    content: string;
    attachmentUrl?: string;
    metadata?: any;
    processedByAI?: boolean;
    aiResponseId?: string;
    isAdminTakeover?: boolean;
    adminId?: string;
  }) {
    return this.prisma.messengerConversation.create({
      data: { customerId, ...data },
    });
  }

  async getConversationContext(customerId: string) {
    return this.prisma.conversationContext.findUnique({
      where: { customerId },
    });
  }

  async updateConversationContext(customerId: string, data: {
    sessionStep?: string;
    collectedData?: any;
    recentMessages?: any;
    lastActiveAt?: Date;
  }) {
    return this.prisma.conversationContext.upsert({
      where: { customerId },
      update: {
        ...data,
        lastActiveAt: data.lastActiveAt || new Date(),
      },
      create: {
        customerId,
        ...data,
        lastActiveAt: data.lastActiveAt || new Date(),
      },
    });
  }

  async exportData(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        billingRequests: {
          include: {
            paymentProofs: { include: { ocrResults: true } },
            activityLogs: true,
          },
        },
        conversations: true,
        conversationContext: true,
        starlinkAccounts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }] },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async deleteData(customerId: string) {
    await this.prisma.$transaction([
      this.prisma.messengerConversation.deleteMany({ where: { customerId } }),
      this.prisma.conversationContext.delete({ where: { customerId } }),
      this.prisma.customer.update({ where: { id: customerId }, data: { isActive: false } }),
    ]);
  }
}
