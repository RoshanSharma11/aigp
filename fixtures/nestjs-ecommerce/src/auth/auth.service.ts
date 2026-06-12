import { Injectable } from "@nestjs/common";

import { LoginDto } from "./dto/login.dto.js";
import { RegisterDto } from "./dto/register.dto.js";
import { RefreshTokenDto } from "./dto/refresh-token.dto.js";
import { SessionEntity } from "./entities/session.entity.js";

@Injectable()
export class AuthService {
  register(_input: RegisterDto): SessionEntity {
    // Mock: create session for new user
    return new SessionEntity({
      accessToken: "fixture-new-user-token",
      refreshToken: "fixture-new-user-refresh"
    });
  }

  login(_input: LoginDto): SessionEntity {
    // Mock: return session
    return new SessionEntity({
      accessToken: "fixture-access-token",
      refreshToken: "fixture-refresh-token"
    });
  }

  refreshToken(_input: RefreshTokenDto): SessionEntity {
    // Mock: return new session
    return new SessionEntity({
      accessToken: "fixture-new-access-token",
      refreshToken: "fixture-new-refresh-token"
    });
  }

  logout(): { success: boolean } {
    // Mock: invalidate session
    return { success: true };
  }

  getCurrentUser(): { userId: string; email: string } {
    // Mock: return current user
    return {
      userId: "user_1",
      email: "user@fixture.local"
    };
  }

  deleteAccount(): { success: boolean } {
    // Mock: delete user account
    return { success: true };
  }
}
