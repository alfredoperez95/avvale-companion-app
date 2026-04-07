import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';
import { trimLowercaseEmail } from './trim-lowercase-email.decorator';

export class MagicLinkRequestDto {
  @trimLowercaseEmail
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(320)
  email!: string;
}
