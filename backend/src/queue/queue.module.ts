import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ActivationsModule } from '../activations/activations.module';
import { activationSendQueueDefaultsFactory, bullRootModuleOptionsFactory } from './bullmq.config';
import { ACTIVATION_SEND_QUEUE } from './queue.constants';
import { ActivationSendProducer } from './producers/activation-send-producer.service';
import { ActivationSendProcessor } from './processors/activation-send.processor';

/**
 * Infraestructura BullMQ. Importar una sola vez (p. ej. desde AppModule o ActivationsModule).
 * El processor y el producer comparten el mismo proceso en v1; en Coolify se puede arrancar un
 * segundo contenedor con el mismo build — TODO entrypoint dedicado al worker si lo separas.
 *
 * Resumen de integración (detalle en docs/ACTIVATION_STATE_MACHINE.md):
 * | Encolar        | POST /api/activations/:id/send → ActivationsService.requestSend → ActivationSendProducer |
 * | Processor      | ActivationSendProcessor (cola `activation-send`)                                        |
 * | Llamada Make   | ActivationSendOrchestrator → MakeService.triggerWebhook                                  |
 * | Cierre ciclo   | POST /api/webhooks/make/callback → MakeService.handleActivationCallback                  |
 */
@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: bullRootModuleOptionsFactory,
      inject: [ConfigService],
    }),
    BullModule.registerQueueAsync({
      name: ACTIVATION_SEND_QUEUE,
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        defaultJobOptions: activationSendQueueDefaultsFactory(config),
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => ActivationsModule),
  ],
  providers: [ActivationSendProducer, ActivationSendProcessor],
  exports: [BullModule, ActivationSendProducer],
})
export class QueueModule {}
