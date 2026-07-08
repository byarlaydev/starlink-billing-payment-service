import { PartialType } from '@nestjs/swagger';
import { CreateRegionPlanDto } from './create-region-plan.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRegionPlanDto extends PartialType(CreateRegionPlanDto) {
  @ApiPropertyOptional({ description: 'Is plan active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
