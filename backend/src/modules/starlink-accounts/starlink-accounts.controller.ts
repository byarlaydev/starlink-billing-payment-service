import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StarlinkAccountsService } from './starlink-accounts.service';
import { CreateStarlinkAccountDto } from './dto/create-starlink-account.dto';
import { UpdateStarlinkAccountDto } from './dto/update-starlink-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Starlink Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('starlink-accounts')
export class StarlinkAccountsController {
  constructor(private readonly starlinkAccountsService: StarlinkAccountsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new Starlink account' })
  @ApiResponse({ status: 201, description: 'Starlink account created successfully' })
  async create(@Body() createDto: CreateStarlinkAccountDto) {
    return this.starlinkAccountsService.create(createDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get all Starlink accounts' })
  @ApiResponse({ status: 200, description: 'List of Starlink accounts' })
  async findAll(
    @Query('customerId') customerId?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.starlinkAccountsService.findAll({
      customerId,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('stats')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get Starlink accounts statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStats() {
    return this.starlinkAccountsService.getStats();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get a Starlink account by ID' })
  @ApiResponse({ status: 200, description: 'Starlink account retrieved successfully' })
  async findById(@Param('id') id: string) {
    return this.starlinkAccountsService.findById(id);
  }

  @Get('customer/:customerId')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get all Starlink accounts for a customer' })
  @ApiResponse({ status: 200, description: 'List of customer Starlink accounts' })
  async findByCustomerId(@Param('customerId') customerId: string) {
    return this.starlinkAccountsService.findByCustomerId(customerId);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a Starlink account' })
  @ApiResponse({ status: 200, description: 'Starlink account updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateStarlinkAccountDto,
  ) {
    return this.starlinkAccountsService.update(id, updateDto);
  }

  @Put(':id/set-primary')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a Starlink account as primary' })
  @ApiResponse({ status: 200, description: 'Account set as primary successfully' })
  async setPrimary(@Param('id') id: string) {
    return this.starlinkAccountsService.setPrimary(id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a Starlink account' })
  @ApiResponse({ status: 204, description: 'Starlink account deleted successfully' })
  async delete(@Param('id') id: string) {
    await this.starlinkAccountsService.delete(id);
  }
}
