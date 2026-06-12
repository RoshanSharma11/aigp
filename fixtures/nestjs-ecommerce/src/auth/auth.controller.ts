import { Body, Controller, Inject, Post } from "@nestjs/common";

import { AuthService } from "./auth.service.js";
import { LoginDto } from "./dto/login.dto.js";
import { SessionEntity } from "./entities/session.entity.js";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {}

  @Post("login")
  login(@Body() input: LoginDto): SessionEntity {
    return this.authService.login(input);
  }
}
