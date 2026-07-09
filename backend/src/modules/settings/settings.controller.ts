import { Controller, Get, Put, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { InventPollingService } from '../../messaging/invent-polling.service';
import { AutoResolveService } from '../../messaging/auto-resolve.service';
import { AutoFollowUpService } from '../../messaging/auto-followup.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly inventPollingService: InventPollingService,
    private readonly autoResolveService: AutoResolveService,
    private readonly autoFollowUpService: AutoFollowUpService,
  ) {}

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
    const result = await this.settingsService.updateBatch(category, updates, req.user?.sub);

    if (category === 'messenger') {
      this.settingsService.clearCache();
      await this.inventPollingService.restartPolling();
      await this.autoFollowUpService.restart();
    }

    return result;
  }

  @Post('messenger/polling/restart')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Restart Invent polling service' })
  async restartPolling() {
    await this.inventPollingService.restartPolling();
    return { success: true, message: 'Polling service restarted' };
  }

  @Get('messenger/polling/status')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Get Invent polling service status' })
  async getPollingStatus() {
    return {
      lastPollTime: this.inventPollingService.getLastPollTime(),
    };
  }

  @Post('messenger/auto-resolve/run')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Manually trigger auto-resolve' })
  async runAutoResolve() {
    const result = await this.autoResolveService.runNow();
    return { success: true, ...result };
  }

  @Get('messenger/auto-resolve/status')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Get auto-resolve service status' })
  async getAutoResolveStatus() {
    return this.autoResolveService.getStatus();
  }

  @Post('messenger/follow-up/run')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Manually trigger auto follow-up' })
  async runFollowUp() {
    const result = await this.autoFollowUpService.runNow();
    return { success: true, ...result };
  }

  @Get('messenger/follow-up/status')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Get auto follow-up service status' })
  async getFollowUpStatus() {
    return this.autoFollowUpService.getStatus();
  }
}
