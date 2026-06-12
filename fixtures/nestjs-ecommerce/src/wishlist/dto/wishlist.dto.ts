import { IsString, IsOptional } from "class-validator";

export class AddToWishlistDto {
  @IsString()
  readonly productId!: string;
}

export class ShareWishlistDto {
  @IsString()
  readonly email!: string;

  @IsString()
  @IsOptional()
  readonly message?: string;
}
