# Phase 02 — RBAC, utilisateurs et provisionnement Keycloak

## Statut

- Prévu — dépend de Phase 00
- Findings traités : **P1-3** (SUPERVISOR rétrograde un ADMIN), **P1-4** (email bloqué après échec Keycloak), **P2-13** (findOne sans cloisonnement département), **P2-14** (keycloak_subject_id sans index/unique), **P2-17** (DB puis Keycloak sans compensation), **P2-20** (auto-désactivation/lock-out), **P2-18** (audit-logs sans DTO), **P3-a** (tempPassword en clair), **P3-e** (PII loggée), **P3-l** (VALID_ROLES dupliqué), **P3-al** (couverture tests users)

## Contexte

Le module `users` concentre l'essentiel des risques RBAC : la garde de `update()` ne vérifie que le rôle attribué, jamais le rôle cible ; l'échec Keycloak soft-delete l'email qui devient inutilisable (contrainte UNIQUE) ; `findOne` n'applique pas le cloisonnement département que `findAll` applique ; les flux DB→Keycloak ne sont ni transactionnels ni compensés.

## Vue d'ensemble

1. **P1-3** : dans `update()`, interdire à un SUPERVISOR toute modification d'un utilisateur dont `userToUpdate.role ∈ {ADMINISTRATOR, SUPERVISOR}` (vérification du rôle cible), en plus des règles actuelles. Test unitaire dédié.
2. **P1-4** : en cas d'échec Keycloak, remplacer le soft-delete par une neutralisation réversible de l'email (`email + ':failed-' + uuid` avec champ `provisioningStatus`) OU un `DELETE` physique ; à défaut capturer `23505` → 409 explicite. Décision D3 du plan à trancher.
3. **P2-14** : migration additive `CREATE UNIQUE INDEX ... ON users(keycloak_subject_id) WHERE keycloak_subject_id IS NOT NULL` ; gérer le conflit au binding (`findProfileBySubject` + UPDATE conditionnel) ; déclarer l'index dans `users.ts`.
4. **P2-13** : passer `currentUser` à `findOne`/`findOneDetailed` et appliquer le filtre département pour SUPERVISOR (même logique que `findAll`).
5. **P2-17** : inverser l'ordre (Keycloak d'abord, puis DB) avec compensation, ou outbox/retry pour la sync des rôles ; au minimum, journaliser l'écart et exposer un endpoint admin de re-sync.
6. **P2-20** : interdire l'auto-désactivation ; exiger au moins un ADMIN actif non-cible avant désactivation/rétrogradation.
7. **P2-18** : créer `AuditLogSearchDto` (class-validator : `@IsUUID`, `@IsDateString`, `@IsIn` pour action/entityType, pagination bornée) et typer `search()`.
8. **P3-a** : remplacer le `tempPassword` de la réponse par un lien de première connexion à usage unique (ou le retirer de la réponse et l'envoyer uniquement par email).
9. **P3-e** : retirer les emails des logs structurés (logger avec identifiants internes uniquement).
10. **P3-l** : extraire `VALID_ROLES` dans un fichier partagé (`src/modules/users/users.roles.ts`) et le réutiliser.

## Exigences

- Aucun changement de contrat OpenAPI des routes users (sauf si décision métier sur tempPassword).
- La migration est additive (index partiel) ; vérifier `db:phase9-check` après.

## Étapes

1. Tests rouges : SUPERVISOR→ADMIN refusé ; recréation après échec Keycloak ; findOne hors département refusé ; auto-désactivation refusée.
2. Correctifs 1→6 avec leurs tests.
3. Migration additive + mise à jour schéma Drizzle.
4. DTO audit-logs + tests 400/422.
5. P3 (tempPassword, logs, VALID_ROLES).
6. Renforcer `users.service.spec.ts` (couvrir update/create/findAll/setOwnAbsence).
7. `pnpm run test:unit` ciblé users + E2E users.

## Fichiers

- **Modifier** : `src/modules/users/users.service.ts`, `users.controller.ts`, DTOs, `src/database/schemas/users.ts`, `src/modules/audit-logs/audit-logs.controller.ts` + service, specs
- **Créer** : `src/modules/users/users.roles.ts`, `src/modules/audit-logs/dto/audit-log-search.dto.ts`, migration `00xx_unique_keycloak_subject.sql`, spec `users.service.fix.spec.ts`

## Todo

- [ ] Garde rôle cible + test (P1-3)
- [ ] Compensation échec Keycloak + test de recréation (P1-4)
- [ ] Index unique partiel + gestion conflit binding (P2-14)
- [ ] Cloisonnement findOne/findOneDetailed (P2-13)
- [ ] Ordre/sync Keycloak avec compensation (P2-17)
- [ ] Garde anti lock-out (P2-20)
- [ ] DTO audit-logs (P2-18)
- [ ] tempPassword / PII / VALID_ROLES (P3)
- [ ] Spec users étoffée (P3-al)
- [ ] Migration vérifiée (`db:phase9-check`)

## Critères de succès

- Gate C atteinte : SUPERVISOR ne peut plus toucher un ADMIN ; un email échoué au provisionnement est recréable.
- Migration additive appliquée en dev sans erreur ; OpenAPI inchangé.
