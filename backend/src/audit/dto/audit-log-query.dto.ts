import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AuditLogQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  page?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  pageSize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  actorUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  module?: string;

  @IsOptional()
  @IsString()
  @MaxLength(96)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(96)
  entity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  entityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  requestId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  includeHealth?: string;
}
