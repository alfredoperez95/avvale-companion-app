import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { AiCredentialsModule } from '../ai-credentials/ai-credentials.module';
import { QueueModule } from '../queue/queue.module';
import { YubiqModule } from '../yubiq/yubiq.module';
import { ExpenseEmailWebhookController } from './expense-email-webhook.controller';
import { ExpensesController } from './expenses.controller';
import { PublicExpenseExportsController } from './public-expense-exports.controller';
import { ExpensesService } from './expenses.service';
import { ExpenseStorageService } from './expense-storage.service';
import { ExpenseAiService } from './expense-ai.service';
import { ExpenseExportService } from './expense-export.service';
import { EXPENSE_DEFAULT_MAX_FILE_BYTES } from './expenses.config';

@Module({
  imports: [
    forwardRef(() => QueueModule),
    AiCredentialsModule,
    YubiqModule,
    MulterModule.register({
      storage: multer.memoryStorage(),
      limits: { fileSize: EXPENSE_DEFAULT_MAX_FILE_BYTES },
    }),
  ],
  controllers: [ExpensesController, PublicExpenseExportsController, ExpenseEmailWebhookController],
  providers: [ExpensesService, ExpenseStorageService, ExpenseAiService, ExpenseExportService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
