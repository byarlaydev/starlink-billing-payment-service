import { Controller, Get, Post, Put, Param, Query, Body, UseGuards, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role, DataReviewStatus } from '@prisma/client';

@ApiTags('customers')
@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'List all customers with filters' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('reviewStatus') reviewStatus?: DataReviewStatus,
  ) {
    return this.customersService.findAll({ page, limit, search, reviewStatus });
  }

  @Get('pending-review')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get customers pending review' })
  async findPendingReview(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.customersService.findPendingReview(page, limit);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Create customer (admin)' })
  async adminCreate(@Body() body: {
    messengerPsid?: string;
    fullName: string;
    facebookName?: string;
    contactNumber?: string;
    emailAddress?: string;
    preferredLang?: 'EN' | 'MY';
  }, @Query('adminId') adminId: string) {
    return this.customersService.adminCreate({ ...body, adminId });
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get customer by ID' })
  async findById(@Param('id') id: string) {
    return this.customersService.findById(id);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Update customer (admin)' })
  async adminUpdate(@Param('id') id: string, @Body() body: {
    fullName?: string;
    facebookName?: string;
    contactNumber?: string;
    emailAddress?: string;
    starlinkEmail?: string;
    starlinkAccount?: string;
    preferredLang?: 'EN' | 'MY';
    adminId: string;
  }) {
    return this.customersService.adminUpdate(id, body);
  }

  @Put(':id/review')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Review bot-collected customer data' })
  async reviewCustomer(@Param('id') id: string, @Body() body: {
    reviewStatus: DataReviewStatus;
    adminId: string;
    reviewNotes?: string;
  }) {
    return this.customersService.reviewCustomer(id, body);
  }

  @Put(':id/takeover')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Admin takes over conversation from bot' })
  async takeOverConversation(@Param('id') id: string, @Body('adminId') adminId: string) {
    return this.customersService.takeOverConversation(id, adminId);
  }

  @Put(':id/release')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Release admin takeover, return to bot' })
  async releaseTakeover(@Param('id') id: string) {
    return this.customersService.releaseTakeover(id);
  }

  @Get(':id/conversations')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get customer conversations' })
  async getConversations(@Param('id') id: string) {
    return this.customersService.getConversations(id);
  }

  @Get(':id/context')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get customer conversation context/memory' })
  async getConversationContext(@Param('id') id: string) {
    return this.customersService.getConversationContext(id);
  }

  @Post(':id/message')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Admin sends message to customer (takeover)' })
  async adminSendMessage(@Param('id') id: string, @Body() body: {
    content: string;
    adminId: string;
  }) {
    const conversation = await this.customersService.addConversation(id, {
      direction: 'outbound',
      messageType: 'text',
      content: body.content,
      isAdminTakeover: true,
      adminId: body.adminId,
    });
    return conversation;
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
