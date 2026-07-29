/**
 * ============================================================================
 * FICHIER : src/common/decorators/idempotent.decorator.ts
 * RÔLE : Décorateur `@Idempotent()` pour la prévention des requêtes réseau en double.
 * EXPLICATION :
 * Lorsqu'un utilisateur clique plusieurs fois d'affilée sur un bouton "Créer un ticket",
 * ce décorateur (associé à un en-tête `Idempotency-Key`) empêche le système de créer des doublons.
 * Si une requête avec la même clé a déjà été traitée dans les dernières 24h, le système
 * renvoie le résultat précédent immédiatement sans réexécuter l'action.
 * ============================================================================
 */

import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

/** Clé de métadonnées pour marquer une route comme idempotente */
export const IDEMPOTENT_KEY = 'idempotent';

/**
 * Décorateur `@Idempotent()` : marque une route comme protégée contre la réexécution en double.
 */
export const Idempotent = () =>
  applyDecorators(
    SetMetadata(IDEMPOTENT_KEY, true),
    ApiHeader({
      name: 'Idempotency-Key',
      required: false,
      description: 'Clé unique de 1 à 128 caractères pour rejouer une mutation sans la dupliquer.',
    }),
  );
