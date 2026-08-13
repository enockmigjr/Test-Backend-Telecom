import { AuthController } from './auth.controller';
import { JwtPayload } from './interfaces/jwt-payload.interface';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(() => {
    controller = new AuthController();
  });

  it('retourne le profil du jeton courant (Keycloak)', () => {
    const user: JwtPayload = {
      sub: 'user-1',
      id: 'user-1',
      email: 'agent@telecom.local',
      role: 'ADMINISTRATOR',
      departmentId: 'dept-1',
      mustChangePassword: false,
      jti: 'jti-1',
    };
    expect(controller.me(user)).toEqual(user);
  });
});
