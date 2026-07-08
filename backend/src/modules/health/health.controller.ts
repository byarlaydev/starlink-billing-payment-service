import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../config/prisma.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  async check() {
    const checks: Record<string, string> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'healthy';
    } catch {
      checks.database = 'unhealthy';
    }

    checks.api = 'healthy';
    checks.timestamp = new Date().toISOString();
    checks.uptime = process.uptime().toString();

    const allHealthy = Object.values(checks).every(v => v === 'healthy' || !isNaN(Number(v)));

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      version: '1.0.0',
    };
  }
}
