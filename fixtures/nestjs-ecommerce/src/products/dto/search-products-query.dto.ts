import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";

export class SearchProductsQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  readonly query?: string;

  @IsOptional()
  @IsString()
  readonly categoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  readonly minPriceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  readonly maxPriceCents?: number;

  @IsOptional()
  @IsBoolean()
  readonly inStockOnly?: boolean;
}
