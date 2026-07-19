import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateKycChatSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @IsIn(['general', 'discovery', 'account', 'org'])
  type?: string;
}

export class StreamKycChatDto {
  @IsString()
  @MaxLength(8000)
  message!: string;
}
