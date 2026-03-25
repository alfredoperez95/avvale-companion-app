import { IsUUID } from 'class-validator';

/** Payload del job: datos mínimos para reconstruir el envío en el worker. */
export class SendActivationJobPayload {
  @IsUUID('4')
  activationId: string;

  @IsUUID('4')
  userId: string;
}
