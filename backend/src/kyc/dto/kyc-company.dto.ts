import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateKycCompanyDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsInt()
  company_id?: number;

  @IsOptional()
  @IsBoolean()
  strategic?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sector?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  revenue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  employees?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  tech_stack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string;
}

export class BulkDeleteKycCompaniesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  ids!: number[];
}

export class ImportKycCompaniesDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsObject({ each: true })
  companies!: Record<string, string>[];
}
