import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class MagicLinkVerifyDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(128)
  token!: string;
}
