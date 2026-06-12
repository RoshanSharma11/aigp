import { IsOptional, IsString, MinLength } from "class-validator";

export class SearchProductsQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  readonly query?: string;
}
