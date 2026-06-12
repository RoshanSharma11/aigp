import { Injectable } from "@nestjs/common";

import { LoginDto } from "./dto/login.dto.js";
import { SessionEntity } from "./entities/session.entity.js";

@Injectable()
export class AuthService {
  login(_input: LoginDto): SessionEntity {
    return new SessionEntity({
      accessToken: "fixture-access-token",
      refreshToken: "fixture-refresh-token"
    });
  }
}
