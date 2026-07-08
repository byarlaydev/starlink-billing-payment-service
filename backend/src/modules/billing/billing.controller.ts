import { Controller, Get, Post, Put, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role, BillingStatus } from '@prisma/client';

@ApiTags('billing')
@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR, Role.VIEWER)
  @ApiOperation({ summary: 'List billing requests with filters' })
  async findAll(
    @Query('status') status?: BillingStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('billingMonth') billingMonth?: string,
  ) {
    return this.billingService.findAll({ status, page, limit, search, billingMonth });
  }

  @Get('stats')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get billing request statistics' })
  async getStats() {
    return this.billingService.getStats();
  }

  @Get('analytics')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Get billing analytics' })
  async getAnalytics(@Query('start') start?: string, @Query('end') end?: string) {
    return this.billingService.getAnalytics(
      start ? new Date(start) : undefined,
      end ? new Date(end) : undefined,
    );
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR, Role.VIEWER)
  @ApiOperation({ summary: 'Get billing request by ID' })
  async findById(@Param('id') id: string) {
    return this.billingService.findById(id);
  }

  @Put(':id/status')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Update billing request status' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: BillingStatus,
    @Body('actorId') actorId: string,
  ) {
    return this.billingService.updateStatus(id, status, actorId);
  }
}
