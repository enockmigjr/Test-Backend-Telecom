/**
 * ============================================================================
 * FICHIER : src/common/decorators/public.decorator.ts
 * RÔLE : Décorateur `@Public()` pour autoriser l'accès anonyme à une route API.
 * EXPLICATION :
 * Par défaut, l'application bloque toutes les requêtes si l'utilisateur n'est pas connecté.
 * En ajoutant `@Public()` au-dessus d'une fonction (ex: la page de connexion `/auth/login`),
 * on indique au système d'outrepasser le contrôle de sécurité par jeton JWT.
 * ============================================================================
 */

import { SetMetadata } from '@nestjs/common';

/** Clé de métadonnées utilisée par le guard d'authentification */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Décorateur `@Public()` : marque une route d'API comme accessible sans authentification.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
