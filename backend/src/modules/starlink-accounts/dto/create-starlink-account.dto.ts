import { IsString, IsEmail, IsOptional, IsBoolean, IsUUID, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStarlinkAccountDto {
  @ApiProperty({ description: 'Customer ID', example: 'uuid-here' })
  @IsUUID()
  customerId: string;

  @ApiProperty({ description: 'Starlink account name', example: 'Home Account' })
  @IsString()
  accountName: string;

  @ApiProperty({ description: 'Starlink account number', example: 'SL-123456' })
  @IsString()
  accountNumber: string;

  @ApiPropertyOptional({ description: 'Starlink account email', example: 'user@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Starlink account password' })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ description: 'Region and Plan ID', example: 'uuid-here' })
  @IsUUID()
  @IsOptional()
  regionPlanId?: string;

  @ApiPropertyOptional({ description: 'Service address' })
  @IsString()
  @IsOptional()
  serviceAddress?: string;

  @ApiPropertyOptional({ description: 'Is this the primary account', default: false })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @ApiPropertyOptional({ description: 'Due date (1-28)', example: 15 })
  @IsInt()
  @Min(1)
  @Max(28)
  @IsOptional()
  dueDate?: number;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
