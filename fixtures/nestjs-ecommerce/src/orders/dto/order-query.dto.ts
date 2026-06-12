import { IsString, IsInt, IsOptional, Min } from "class-validator";

export class ApplyCouponToOrderDto {
  @IsString()
  readonly couponCode!: string;

  @IsInt()
  @Min(0)
  readonly discountCents!: number;
}

export class UpdateDeliveryAddressDto {
  @IsString()
  readonly address!: string;

  @IsString()
  @IsOptional()
  readonly city?: string;

  @IsString()
  @IsOptional()
  readonly postalCode?: string;
}

export class ListOrdersQueryDto {
  @IsInt()
  @IsOptional()
  @Min(1)
  readonly limit?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  readonly offset?: number;

  @IsString()
  @IsOptional()
  readonly status?: string;
}
