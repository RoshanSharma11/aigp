import { IsString, IsBoolean, IsOptional } from "class-validator";

export class UpdatePreferencesDto {
  @IsBoolean()
  @IsOptional()
  readonly emailNotifications?: boolean;

  @IsBoolean()
  @IsOptional()
  readonly pushNotifications?: boolean;

  @IsBoolean()
  @IsOptional()
  readonly smsNotifications?: boolean;
}
