import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { StarlinkAccount } from '@prisma/client';

@Injectable()
export class StarlinkAccountsService {
  private readonly logger = new Logger(StarlinkAccountsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    customerId: string;
    accountName: string;
    accountNumber: string;
    email?: string;
    password?: string;
    regionPlanId?: string;
    serviceAddress?: string;
    isPrimary?: boolean;
    notes?: string;
  }): Promise<StarlinkAccount> {
    // If this is the first account or marked as primary, update other accounts
    if (data.isPrimary) {
      await this.prisma.starlinkAccount.updateMany({
        where: { customerId: data.customerId },
        data: { isPrimary: false },
      });
    }

    // Check if this is the first account for this customer
    const existingCount = await this.prisma.starlinkAccount.count({
      where: { customerId: data.customerId },
    });

    const account = await this.prisma.starlinkAccount.create({
      data: {
        customerId: data.customerId,
        accountName: data.accountName,
        accountNumber: data.accountNumber,
        email: data.email,
        password: data.password,
        regionPlanId: data.regionPlanId,
        serviceAddress: data.serviceAddress,
        isPrimary: data.isPrimary ?? existingCount === 0,
        notes: data.notes,
      },
      include: {
        regionPlan: true,
      },
    });

    this.logger.log(`Created Starlink account ${account.id} for customer ${data.customerId}`);
    return account;
  }

  async findAll(filter?: {
    customerId?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};
    if (filter?.customerId) where.customerId = filter.customerId;
    if (filter?.isActive !== undefined) where.isActive = filter.isActive;

    const page = filter?.page || 1;
    const limit = filter?.limit || 20;

    const [data, total] = await Promise.all([
      this.prisma.starlinkAccount.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
        include: {
          customer: {
            select: {
              id: true,
              fullName: true,
              facebookName: true,
              messengerPsid: true,
            },
          },
          regionPlan: true,
        },
      }),
      this.prisma.starlinkAccount.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<StarlinkAccount> {
    const account = await this.prisma.starlinkAccount.findUnique({
      where: { id },
      include: { 
        customer: true,
        regionPlan: true,
      },
    });
    if (!account) {
      throw new NotFoundException(`Starlink account ${id} not found`);
    }
    return account;
  }

  async findByCustomerId(customerId: string): Promise<StarlinkAccount[]> {
    return this.prisma.starlinkAccount.findMany({
      where: { customerId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
      include: {
        regionPlan: true,
      },
    });
  }

  async update(
    id: string,
    data: {
      accountName?: string;
      accountNumber?: string;
      email?: string;
      password?: string;
      regionPlanId?: string;
      serviceAddress?: string;
      isPrimary?: boolean;
      isActive?: boolean;
      notes?: string;
    },
  ): Promise<StarlinkAccount> {
    const account = await this.findById(id);

    // If setting as primary, unset other primary accounts
    if (data.isPrimary) {
      await this.prisma.starlinkAccount.updateMany({
        where: { customerId: account.customerId, id: { not: id } },
        data: { isPrimary: false },
      });
    }

    const updated = await this.prisma.starlinkAccount.update({
      where: { id },
      data,
      include: {
        regionPlan: true,
      },
    });

    this.logger.log(`Updated Starlink account ${id}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const account = await this.findById(id);

    await this.prisma.starlinkAccount.delete({ where: { id } });

    // If deleted account was primary, set another as primary
    if (account.isPrimary) {
      const nextPrimary = await this.prisma.starlinkAccount.findFirst({
        where: { customerId: account.customerId },
        orderBy: { createdAt: 'desc' },
      });

      if (nextPrimary) {
        await this.prisma.starlinkAccount.update({
          where: { id: nextPrimary.id },
          data: { isPrimary: true },
        });
      }
    }

    this.logger.log(`Deleted Starlink account ${id}`);
  }

  async setPrimary(id: string): Promise<StarlinkAccount> {
    const account = await this.findById(id);

    await this.prisma.starlinkAccount.updateMany({
      where: { customerId: account.customerId },
      data: { isPrimary: false },
    });

    const updated = await this.prisma.starlinkAccount.update({
      where: { id },
      data: { isPrimary: true },
      include: {
        regionPlan: true,
      },
    });

    return updated;
  }

  async getStats() {
    const [total, active, primary] = await Promise.all([
      this.prisma.starlinkAccount.count(),
      this.prisma.starlinkAccount.count({ where: { isActive: true } }),
      this.prisma.starlinkAccount.count({ where: { isPrimary: true } }),
    ]);

    return { total, active, primary };
  }
}
