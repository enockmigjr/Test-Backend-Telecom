import { CustomDecorator, SetMetadata } from '@nestjs/common';

export const ALLOW_PASSWORD_CHANGE_PENDING_KEY = 'allow_password_change_pending';

/**
 * Autorise explicitement une route même si l'utilisateur a un changement de
 * mot de passe en attente (claim `mustChangePassword` du profil métier).
 */
export function AllowPasswordChangePending(): CustomDecorator<string> {
  return SetMetadata(ALLOW_PASSWORD_CHANGE_PENDING_KEY, true);
}
