import { IsArray, IsInt, IsObject, Min } from "class-validator";

export class ProductImportItem {
  readonly id!: string;
  readonly name!: string;
  readonly categoryId!: string;
  readonly priceCents!: number;
  readonly currency!: string;
}

export class BulkImportProductsDto {
  @IsArray()
  readonly products!: readonly ProductImportItem[];

  @IsInt()
  @Min(1)
  readonly batchSize?: number;
}
