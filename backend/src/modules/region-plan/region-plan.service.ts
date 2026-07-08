import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { StarlinkRegionAndPlan } from '@prisma/client';

@Injectable()
export class RegionPlanService {
  private readonly logger = new Logger(RegionPlanService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    region: string;
    plan: string;
    description?: string;
    price?: number;
    currency?: string;
  }): Promise<StarlinkRegionAndPlan> {
    const regionPlan = await this.prisma.starlinkRegionAndPlan.create({
      data: {
        region: data.region,
        plan: data.plan,
        description: data.description,
        price: data.price,
        currency: data.currency || 'USD',
      },
    });

    this.logger.log(`Created Starlink region and plan: ${data.region} - ${data.plan}`);
    return regionPlan;
  }

  async findAll(filter?: {
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};
    if (filter?.isActive !== undefined) where.isActive = filter.isActive;

    const page = filter?.page || 1;
    const limit = filter?.limit || 50;

    const [data, total] = await Promise.all([
      this.prisma.starlinkRegionAndPlan.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ region: 'asc' }, { plan: 'asc' }],
      }),
      this.prisma.starlinkRegionAndPlan.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<StarlinkRegionAndPlan> {
    const regionPlan = await this.prisma.starlinkRegionAndPlan.findUnique({
      where: { id },
    });
    if (!regionPlan) {
      throw new NotFoundException(`Starlink region and plan ${id} not found`);
    }
    return regionPlan;
  }

  async update(
    id: string,
    data: {
      region?: string;
      plan?: string;
      description?: string;
      price?: number;
      currency?: string;
      isActive?: boolean;
    },
  ): Promise<StarlinkRegionAndPlan> {
    await this.findById(id);

    const updated = await this.prisma.starlinkRegionAndPlan.update({
      where: { id },
      data,
    });

    this.logger.log(`Updated Starlink region and plan ${id}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.starlinkRegionAndPlan.delete({ where: { id } });
    this.logger.log(`Deleted Starlink region and plan ${id}`);
  }

  async getStats() {
    const [total, active] = await Promise.all([
      this.prisma.starlinkRegionAndPlan.count(),
      this.prisma.starlinkRegionAndPlan.count({ where: { isActive: true } }),
    ]);

    return { total, active };
  }
}
