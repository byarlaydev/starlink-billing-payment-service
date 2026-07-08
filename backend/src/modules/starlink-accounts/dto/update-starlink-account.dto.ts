import { PartialType } from '@nestjs/swagger';
import { CreateStarlinkAccountDto } from './create-starlink-account.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStarlinkAccountDto extends PartialType(CreateStarlinkAccountDto) {
  @ApiPropertyOptional({ description: 'Is account active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
