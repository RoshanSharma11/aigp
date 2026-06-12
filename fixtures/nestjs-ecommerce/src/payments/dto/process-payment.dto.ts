import { IsString, IsInt, Min, IsOptional } from "class-validator";

export class ProcessPaymentDto {
  @IsString()
  readonly orderId!: string;

  @IsInt()
  @Min(1)
  readonly amountCents!: number;

  @IsString()
  readonly method!: string;

  @IsString()
  @IsOptional()
  readonly cardToken?: string;
}

export class RefundPaymentDto {
  @IsString()
  readonly paymentId!: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  readonly amountCents?: number;

  @IsString()
  @IsOptional()
  readonly reason?: string;
}
