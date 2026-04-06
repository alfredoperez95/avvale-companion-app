import { IsString, MaxLength, MinLength } from 'class-validator';

export class PostRfqMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32_000)
  content!: string;
}
