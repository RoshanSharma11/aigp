import { IsString, IsInt, Min, Max, IsOptional } from "class-validator";

export class CreateReviewDto {
  @IsString()
  readonly productId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  readonly rating!: number;

  @IsString()
  readonly title!: string;

  @IsString()
  readonly content!: string;
}

export class UpdateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  readonly rating?: number;

  @IsString()
  @IsOptional()
  readonly title?: string;

  @IsString()
  @IsOptional()
  readonly content?: string;
}
