import { IsInt, IsString, Min } from "class-validator";

export class AddCartItemDto {
  @IsString()
  readonly productId!: string;

  @IsInt()
  @Min(1)
  readonly quantity!: number;
}
