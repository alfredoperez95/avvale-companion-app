import { IsOptional, IsString, MaxLength } from 'class-validator';

export class KycAuditLogQueryDto {
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
  @MaxLength(32)
  companyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  actorUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(96)
  action?: string;
}
