import { Controller, Get, Param, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ExpenseExportService } from './expense-export.service';

@Controller('public/expense-exports')
export class PublicExpenseExportsController {
  constructor(private readonly expenseExports: ExpenseExportService) {}

  @Get(':token/:fileName')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async download(@Param('token') token: string, @Param('fileName') fileName: string, @Res() res: Response) {
    const file = await this.expenseExports.getPublicFile(token, fileName);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', inlineDisposition(file.fileName));
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(file.buffer);
  }
}

function inlineDisposition(fileName: string): string {
  const fallback = fileName.replace(/[^\w.\- ]+/g, '_').replace(/"/g, '');
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
