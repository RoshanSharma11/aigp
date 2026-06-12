import { IsString, IsInt, IsArray, Min, IsOptional } from "class-validator";

export class OrderItemInput {
  @IsString()
  readonly productId!: string;

  @IsInt()
  @Min(1)
  readonly quantity!: number;

  @IsInt()
  @Min(0)
  readonly priceCents!: number;
}

export class CreateOrderDto {
  @IsArray()
  readonly items!: readonly OrderItemInput[];

  @IsString()
  @IsOptional()
  readonly deliveryAddress?: string;

  @IsString()
  @IsOptional()
  readonly couponCode?: string;
}
