import { IsString, IsOptional, IsNumber, IsInt, Min, Max } from 'class-validator';
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

  @ApiPropertyOptional({ description: 'Due date (1-28)', example: 15 })
  @IsInt()
  @Min(1)
  @Max(28)
  @IsOptional()
  dueDate?: number;
}
