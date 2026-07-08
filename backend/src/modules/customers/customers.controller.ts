import { Controller, Get, Param, Query, UseGuards, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('customers')
@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'List all customers' })
  async findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.customersService.findAll(page, limit);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get customer by ID' })
  async findById(@Param('id') id: string) {
    return this.customersService.findById(id);
  }

  @Get(':id/conversations')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get customer conversations' })
  async getConversations(@Param('id') id: string) {
    return this.customersService.getConversations(id);
  }

  @Get(':id/export')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Export customer data (GDPR)' })
  async exportData(@Param('id') id: string) {
    return this.customersService.exportData(id);
  }

  @Delete(':id/data')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete customer data (GDPR)' })
  async deleteData(@Param('id') id: string) {
    return this.customersService.deleteData(id);
  }
}
