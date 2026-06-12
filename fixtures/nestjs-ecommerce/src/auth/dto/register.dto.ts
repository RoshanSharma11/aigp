import { IsEmail, IsString, MinLength, IsOptional } from "class-validator";

export class RegisterDto {
  @IsEmail()
  readonly email!: string;

  @IsString()
  @MinLength(6)
  readonly password!: string;

  @IsString()
  @IsOptional()
  readonly firstName?: string;

  @IsString()
  @IsOptional()
  readonly lastName?: string;
}
