import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { ConversationState, Language } from '@prisma/client';

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
        },
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
  }) {
    return this.prisma.customer.update({ where: { id: customerId }, data });
  }

  async findById(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { billingRequests: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async findAll(page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { billingRequests: true } } },
      }),
      this.prisma.customer.count(),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
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
  }) {
    return this.prisma.messengerConversation.create({
      data: { customerId, ...data },
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
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async deleteData(customerId: string) {
    await this.prisma.$transaction([
      this.prisma.messengerConversation.deleteMany({ where: { customerId } }),
      this.prisma.customer.update({ where: { id: customerId }, data: { isActive: false } }),
    ]);
  }
}
