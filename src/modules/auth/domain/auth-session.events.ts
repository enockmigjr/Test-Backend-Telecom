export class AuthSessionRevokedEvent {
  constructor(
    public readonly userId: string,
    public readonly jti: string,
  ) {}
}

export class AuthUserSessionsRevokedEvent {
  constructor(public readonly userId: string) {}
}
