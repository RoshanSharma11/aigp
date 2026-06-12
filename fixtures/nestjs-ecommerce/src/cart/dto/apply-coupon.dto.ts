import { IsString, IsInt, Min } from "class-validator";

export class ApplyCouponDto {
  @IsString()
  readonly couponCode!: string;

  @IsInt()
  @Min(1)
  readonly discountPercentage!: number;
}
