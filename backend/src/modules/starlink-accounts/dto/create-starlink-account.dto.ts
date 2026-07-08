import { IsString, IsEmail, IsOptional, IsBoolean, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStarlinkAccountDto {
  @ApiProperty({ description: 'Customer ID', example: 'uuid-here' })
  @IsUUID()
  customerId: string;

  @ApiProperty({ description: 'Starlink account email', example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'Starlink account number', example: 'SL-123456' })
  @IsString()
  @IsOptional()
  accountNumber?: string;

  @ApiPropertyOptional({ description: 'Account nickname', example: 'Home Account' })
  @IsString()
  @IsOptional()
  nickname?: string;

  @ApiPropertyOptional({ description: 'Is this the primary account', default: false })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
