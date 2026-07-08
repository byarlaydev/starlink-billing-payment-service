import { Module } from '@nestjs/common';
import { RegionPlanService } from './region-plan.service';
import { RegionPlanController } from './region-plan.controller';

@Module({
  controllers: [RegionPlanController],
  providers: [RegionPlanService],
  exports: [RegionPlanService],
})
export class RegionPlanModule {}
