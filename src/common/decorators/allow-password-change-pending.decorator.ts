/**
 * ============================================================================
 * FICHIER : src/common/decorators/allow-password-change-pending.decorator.ts
 * RÔLE : Décorateur pour autoriser l'accès lors d'un changement de mot de passe obligatoire.
 * EXPLICATION :
 * Lorsqu'un administrateur crée un utilisateur, celui-ci reçoit un mot de passe temporaire
 * et est bloqué sur toutes les routes tant qu'il n'a pas changé son mot de passe.
 * Ce décorateur marque la route `/auth/change-password` pour qu'elle reste accessible
 * même avec ce statut de blocage temporaire.
 * ============================================================================
 */

import { SetMetadata } from '@nestjs/common';

/** Clé de métadonnées pour autoriser l'accès pendant le changement de mot de passe */
export const ALLOW_PASSWORD_CHANGE_PENDING_KEY = 'allowPasswordChangePending';

/**
 * Décorateur `@AllowPasswordChangePending()`
 */
export const AllowPasswordChangePending = () => SetMetadata(ALLOW_PASSWORD_CHANGE_PENDING_KEY, true);
