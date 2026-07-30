# Phase 02 — Intégrations, identité publique et sécurité

## Contexte

Le public ne peut pas utiliser le JWT interne. L’identité doit être vérifiée sans imposer de compte et sans répéter l’OTP sur un appareil reconnu.

## Vue d’ensemble

Créer l’administration des intégrations, la vérification email, les appareils de confiance et l’échange d’assertion WordPress avec audiences et secrets distincts.

## Exigences

- Email vérifié suffisant pour la Release 1 ; téléphone facultatif et seulement via fournisseur réel.
- Appareil de confiance 90 jours par défaut, durée bornée et versionnée.
- Jeton d’appareil aléatoire, rotatif et seulement haché en base.
- Secret d’intégration chiffré AES-GCM avec clé maître versionnée.
- Réponses de vérification anti-énumération et quotas composites.
- Le BFF place les cookies ; NestJS valide le principal public.

## Architecture

Le BFF détient un court jeton d’accès public et un jeton opaque d’appareil. Leur issuer, audience, clés et cookies diffèrent de l’auth interne. Une assertion WordPress est échangée une seule fois contre cette session. Un bootstrap à usage unique transfère une identité de l’iframe vers un contexte pleine page sans partager le cookie partitionné.

## Étapes

1. Créer `src/modules/support-integrations/` : CRUD admin, origines exactes, fonctions, quotas, routage, statut et rotation de secret.
2. Créer `src/modules/external-identity/` : profil, identité, challenge, appareil, session, révocation et assertion.
3. Ajouter `AuthMode = ANONYMOUS | INTERNAL | PUBLIC_SESSION | INTEGRATION_ASSERTION`, son décorateur et un garde global d’orchestration ; le mode absent reste `INTERNAL`.
4. Faire déléguer ce garde à l’auth interne ou publique et adapter `PasswordChangeRequiredGuard` au seul mode interne, sans combinaison implicite `@Public()` + garde local.
5. Inventorier puis migrer les `@Public()` existants de auth, app info, health, metrics et rapports signés vers `AuthMode.ANONYMOUS`, avec test de parité avant suppression du décorateur legacy.
6. Implémenter challenge email avec le module email existant, HMAC du code, expiration, essais bornés et délai de renvoi.
7. Prévoir `contact-verification-provider.interface.ts`; ne livrer SMS que si un fournisseur réel et ses tests sont disponibles.
8. Émettre un accès public court et un jeton d’appareil opaque ; renouveler les 90 jours seulement selon la politique.
9. Lors d’une réduction de durée, raccourcir ou révoquer les appareils dépassant la nouvelle politique.
10. Vérifier assertion WordPress : signature, intégration active, audience, origine, expiration, identité et nonce Redis `SET NX EX`.
11. Refuser l’échange si Redis ne peut pas garantir l’anti-rejeu.
12. Créer un bootstrap top-level opaque : hash en base, audience, intégration, expiration courte et consommation atomique unique.
13. Créer les opérations request/consume du bootstrap et du lien email ; les codes circulent en corps POST, jamais dans query ou logs.
14. Appliquer quotas par IP pseudonymisée, intégration, contact et appareil ; CAPTCHA seulement après risque.
15. Ajouter routes admin de révocation, appareils, secret et audit sans jamais retourner la valeur du secret.
16. Versionner dans OpenAPI `publicSession` et `integrationAssertion`, séparés du Bearer interne.

## Fichiers centraux

- `src/modules/external-identity/services/contact-verification.service.ts`
- `src/modules/external-identity/services/trusted-device.service.ts`
- `src/modules/external-identity/services/integration-assertion.service.ts`
- `src/modules/external-identity/services/integration-secret.service.ts`
- `src/modules/public-support/guards/public-session.guard.ts`
- `src/common/decorators/auth-mode.decorator.ts`
- `src/modules/auth/guards/request-auth.guard.ts`
- `src/config/app.config.ts`, `.env.example`, `src/app.module.ts`
- nouveaux templates sous `src/modules/email/templates/`

## Todo et tests

- [ ] OTP : expiration, rejeu, essais, renvoi et réponse uniforme.
- [ ] Appareil : émission, rotation, renouvellement, réduction et révocation.
- [ ] Assertion : audience, origine, nonce, secret ancien/nouveau et Redis absent.
- [ ] Auth mode : JWT public refusé en interne, JWT interne refusé en public et aucune route session anonyme.
- [ ] Parité : login, refresh, app info, health, metrics et téléchargement signé gardent leur accessibilité exacte.
- [ ] Bootstrap : fragment client, échange POST, consommation unique, expiration et URL nettoyée.
- [ ] Isolation : identités identiques dans deux intégrations non fusionnées.
- [ ] Logs : aucun OTP, jeton, secret, email ou téléphone complet.
- [ ] Inventaire public-support : seules config, vérification initiale et consommation de code sont anonymes ; tickets, appareils et préférences exigent `PUBLIC_SESSION`.

## Critères de succès

- Un contact vérifié reprend ses tickets sans compte interne.
- Un appareil révoqué ne peut plus renouveler la session.
- Une assertion WordPress ne fonctionne qu’une fois et pour son intégration.
- Les routes internes n’acceptent jamais un principal public.
