export class SessionEntity {
  readonly accessToken: string;
  readonly refreshToken: string;

  constructor(input: { accessToken: string; refreshToken: string }) {
    this.accessToken = input.accessToken;
    this.refreshToken = input.refreshToken;
  }
}
