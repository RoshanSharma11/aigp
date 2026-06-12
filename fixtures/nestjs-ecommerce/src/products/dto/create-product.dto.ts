import { IsString, IsInt, IsBoolean, IsArray, IsOptional, MinLength, Min } from "class-validator";

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  readonly name!: string;

  @IsString()
  @IsOptional()
  readonly description?: string;

  @IsString()
  readonly categoryId!: string;

  @IsInt()
  @Min(0)
  readonly priceCents!: number;

  @IsString()
  readonly currency!: string;

  @IsString()
  @IsOptional()
  readonly brand?: string;

  @IsInt()
  @Min(0)
  readonly initialStock!: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  readonly tags?: readonly string[];

  @IsBoolean()
  @IsOptional()
  readonly featured?: boolean;
}
