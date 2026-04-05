import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class MagicLinkVerifyDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  token!: string;
}
