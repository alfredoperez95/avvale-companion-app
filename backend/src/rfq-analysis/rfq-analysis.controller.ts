import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserPayload } from '../auth/decorators/user-payload';
import { RfqAnalysisService } from './rfq-analysis.service';
import { CreateRfqAnalysisDto } from './dto/create-rfq-analysis.dto';
import { PostRfqMessageDto } from './dto/post-rfq-message.dto';
import { PatchRfqRecommendedQuestionsDto } from './dto/patch-rfq-recommended-questions.dto';
import { ConfigService } from '@nestjs/config';
import { getRfqMaxAttachments, RFQ_DEFAULT_MAX_FILE_BYTES } from './rfq-analysis.config';

const MAX_FILES_UPLOAD_BATCH = 20;

@Controller('rfq-analyses')
@UseGuards(JwtAuthGuard)
export class RfqAnalysisController {
  constructor(
    private readonly rfq: RfqAnalysisService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: UserPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.rfq.list(user.userId, { page, pageSize });
  }

  @Post()
  async create(@CurrentUser() user: UserPayload, @Body() dto: CreateRfqAnalysisDto) {
    return this.rfq.create(user.userId, dto);
  }

  @Get(':id')
  async getOne(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.rfq.findOne(user.userId, id);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.rfq.remove(user.userId, id);
  }

  @Post(':id/sources')
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_UPLOAD_BATCH, {
      limits: { fileSize: RFQ_DEFAULT_MAX_FILE_BYTES },
    }),
  )
  async uploadSources(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ) {
    const max = getRfqMaxAttachments(this.config);
    const list = files?.length ? files : [];
    if (list.length > max) {
      throw new BadRequestException(`Máximo ${max} archivos por petición`);
    }
    return this.rfq.uploadSources(user.userId, id, list);
  }

  @Post(':id/process')
  async process(@CurrentUser() user: UserPayload, @Param('id') id: string) {
    return this.rfq.requestProcess(user.userId, id);
  }

  @Patch(':id/recommended-questions')
  async patchRecommendedQuestions(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: PatchRfqRecommendedQuestionsDto,
  ) {
    return this.rfq.updateRecommendedQuestions(user.userId, id, dto.questions);
  }

  @Post(':id/messages')
  async postMessage(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: PostRfqMessageDto,
  ) {
    return this.rfq.postMessage(user.userId, id, dto);
  }
}
