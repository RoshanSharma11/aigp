import { IsString, IsEmail, IsOptional, IsInt, Min } from "class-validator";

export class UpdateUserRoleDto {
  @IsString()
  readonly role!: string;
}

export class ListUsersQueryDto {
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
  readonly role?: string;
}
