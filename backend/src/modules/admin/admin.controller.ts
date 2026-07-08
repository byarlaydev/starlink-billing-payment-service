import { Controller, Get, Post, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('users')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create admin user' })
  async create(@Body() body: { email: string; password: string; fullName: string; role?: Role }) {
    return this.adminService.create(body);
  }

  @Get('users')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List admin users' })
  async findAll() {
    return this.adminService.findAll();
  }

  @Get('users/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get admin user' })
  async findById(@Param('id') id: string) {
    return this.adminService.findById(id);
  }

  @Put('users/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update admin user' })
  async update(@Param('id') id: string, @Body() body: { fullName?: string; role?: Role; isActive?: boolean }) {
    return this.adminService.update(id, body);
  }

  @Put('users/:id/password')
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @Param('id') id: string,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.adminService.changePassword(id, body.currentPassword, body.newPassword);
  }

  @Get('activity-logs')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Get activity logs' })
  async getActivityLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('billingRequestId') billingRequestId?: string,
  ) {
    return this.adminService.getActivityLogs(page, limit, billingRequestId);
  }
}
