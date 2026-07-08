import { IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRegionPlanDto {
  @ApiProperty({ description: 'Starlink region', example: 'United States' })
  @IsString()
  region: string;

  @ApiProperty({ description: 'Starlink plan name', example: 'Residential Standard' })
  @IsString()
  plan: string;

  @ApiPropertyOptional({ description: 'Plan description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Monthly price', example: 120.00 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({ description: 'Currency', example: 'USD', default: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;
}
