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
import { RegionPlanService } from './region-plan.service';
import { CreateRegionPlanDto } from './dto/create-region-plan.dto';
import { UpdateRegionPlanDto } from './dto/update-region-plan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Starlink Region and Plan')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('region-plan')
export class RegionPlanController {
  constructor(private readonly regionPlanService: RegionPlanService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new Starlink region and plan' })
  @ApiResponse({ status: 201, description: 'Region and plan created successfully' })
  async create(@Body() createDto: CreateRegionPlanDto) {
    return this.regionPlanService.create(createDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get all Starlink regions and plans' })
  @ApiResponse({ status: 200, description: 'List of regions and plans' })
  async findAll(
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.regionPlanService.findAll({
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('stats')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get region and plan statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStats() {
    return this.regionPlanService.getStats();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get a region and plan by ID' })
  @ApiResponse({ status: 200, description: 'Region and plan retrieved successfully' })
  async findById(@Param('id') id: string) {
    return this.regionPlanService.findById(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a region and plan' })
  @ApiResponse({ status: 200, description: 'Region and plan updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateRegionPlanDto,
  ) {
    return this.regionPlanService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a region and plan' })
  @ApiResponse({ status: 204, description: 'Region and plan deleted successfully' })
  async delete(@Param('id') id: string) {
    await this.regionPlanService.delete(id);
  }
}
