import { Controller, Get, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Get all settings grouped by category' })
  async getAll() {
    return this.settingsService.getAll();
  }

  @Get(':category')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Get settings by category' })
  async getByCategory(@Param('category') category: string) {
    return this.settingsService.getByCategory(category);
  }

  @Put(':category')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update settings for a category' })
  async updateCategory(
    @Param('category') category: string,
    @Body() updates: Record<string, string>,
    @Request() req: any,
  ) {
    return this.settingsService.updateBatch(category, updates, req.user?.sub);
  }
}
