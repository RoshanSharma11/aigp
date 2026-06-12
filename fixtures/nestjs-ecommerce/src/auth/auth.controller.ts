import { Body, Controller, Inject, Post, UseGuards, Delete, Get } from "@nestjs/common";

import { AuthService } from "./auth.service.js";
import { AuthGuard } from "./auth.guard.js";
import { LoginDto } from "./dto/login.dto.js";
import { RegisterDto } from "./dto/register.dto.js";
import { RefreshTokenDto } from "./dto/refresh-token.dto.js";
import { SessionEntity } from "./entities/session.entity.js";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {}

  @Post("register")
  register(@Body() input: RegisterDto): SessionEntity {
    return this.authService.register(input);
  }

  @Post("login")
  login(@Body() input: LoginDto): SessionEntity {
    return this.authService.login(input);
  }

  @Post("refresh-token")
  refreshToken(@Body() input: RefreshTokenDto): SessionEntity {
    return this.authService.refreshToken(input);
  }

  @Post("logout")
  @UseGuards(AuthGuard)
  logout(): { success: boolean } {
    return this.authService.logout();
  }

  @Get("me")
  @UseGuards(AuthGuard)
  getCurrentUser(): { userId: string; email: string } {
    return this.authService.getCurrentUser();
  }

  @Delete("account")
  @UseGuards(AuthGuard)
  deleteAccount(): { success: boolean } {
    return this.authService.deleteAccount();
  }
}
