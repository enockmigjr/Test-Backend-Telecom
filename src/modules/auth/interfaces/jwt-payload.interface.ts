/**
 * Payload du JWT Access Token.
 */
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  departmentId: string;
  jti: string;
}
