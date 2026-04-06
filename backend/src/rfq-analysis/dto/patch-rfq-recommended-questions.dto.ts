import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

export class PatchRfqRecommendedQuestionsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(12000, { each: true })
  questions!: string[];
}
