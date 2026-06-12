import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateAddressDto {
  @IsString()
  readonly label!: string;

  @IsString()
  @MinLength(3)
  readonly line1!: string;

  @IsString()
  readonly city!: string;

  @IsString()
  readonly region!: string;

  @IsString()
  readonly postalCode!: string;

  @IsString()
  readonly country!: string;

  @IsOptional()
  @IsBoolean()
  readonly isDefault?: boolean;
}
