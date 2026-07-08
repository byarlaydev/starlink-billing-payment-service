import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: { email: string; password: string; fullName: string; role?: Role }) {
    const existing = await this.prisma.adminUser.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(data.password, 12);

    const admin = await this.prisma.adminUser.create({
      data: {
        email: data.email,
        passwordHash,
        fullName: data.fullName,
        role: data.role || Role.ADMIN,
      },
      select: { id: true, email: true, fullName: true, role: true, createdAt: true },
    });

    return admin;
  }

  async findAll() {
    return this.prisma.adminUser.findMany({
      select: { id: true, email: true, fullName: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id },
      select: { id: true, email: true, fullName: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
    });
    if (!admin) throw new NotFoundException('Admin user not found');
    return admin;
  }

  async update(id: string, data: { fullName?: string; role?: Role; isActive?: boolean }) {
    return this.prisma.adminUser.update({
      where: { id },
      data,
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
    });
  }

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!admin) throw new NotFoundException('Admin user not found');

    const isValid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isValid) throw new ConflictException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.adminUser.update({ where: { id }, data: { passwordHash } });
  }

  async getActivityLogs(page = 1, limit = 50, billingRequestId?: string) {
    const where = billingRequestId ? { billingRequestId } : {};
    const [data, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.activityLog.count({ where }),
    ]);
    return { data, total, page, limit };
  }
}
