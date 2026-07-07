import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { AiCredentialsModule } from '../ai-credentials/ai-credentials.module';
import { YubiqModule } from '../yubiq/yubiq.module';
import { ExpensesController } from './expenses.controller';
import { PublicExpenseExportsController } from './public-expense-exports.controller';
import { ExpensesService } from './expenses.service';
import { ExpenseStorageService } from './expense-storage.service';
import { ExpenseAiService } from './expense-ai.service';
import { ExpenseExportService } from './expense-export.service';
import { EXPENSE_DEFAULT_MAX_FILE_BYTES } from './expenses.config';

@Module({
  imports: [
    AiCredentialsModule,
    YubiqModule,
    MulterModule.register({
      storage: multer.memoryStorage(),
      limits: { fileSize: EXPENSE_DEFAULT_MAX_FILE_BYTES },
    }),
  ],
  controllers: [ExpensesController, PublicExpenseExportsController],
  providers: [ExpensesService, ExpenseStorageService, ExpenseAiService, ExpenseExportService],
})
export class ExpensesModule {}
