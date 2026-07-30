# Audit frontend et WordPress pour le plan multicanal

## Périmètre

Lecture du frontend interne Next.js, du thème PhotoVault, des plugins actifs et des scripts de synchronisation de miroirs. Aucun fichier modifié et aucun test lancé.

## Constats

- Aucun portail public ou widget n’existe.
- `frontend/` est un dépôt Next.js 16 autonome avec BFF, cookies HttpOnly, CSRF Origin/Host et contrats Zod.
- Ces patterns sont réutilisables, mais ni session ni cookies internes ne doivent être partagés.
- Les schémas tickets supposent encore `createdBy`, `authorId` et `userId` internes obligatoires.
- `discussion-panel.tsx` distingue déjà commentaires et notes, mais pas encore « réponse demandeur » et « note interne » avec acteur externe.
- Le thème est présentation uniquement et expose les hooks nécessaires ; aucune modification du thème n’est requise.
- Les plugins exécutés sont sous `wp-content/plugins/`, leurs copies du thème sont des miroirs.
- `identity_security_kit_is_email_verified()` et `identity_security_kit_is_phone_verified()` sont les contrôles sûrs.
- `photovault_user_has_verified_identity()` ne convient pas : il contient des bypass et un fallback permissif.

## Recommandations retenues

- créer `public-frontend/` comme dépôt autonome et BFF public même origine ;
- iframe isolée, protocole `postMessage` validé et fallback pleine page ;
- plugin actif `trouble-ticket-connector` sans stockage des tickets ;
- assertion courte avec audience, intégration, sujet opaque, expiration et nonce ;
- email WordPress vérifié suffisant, téléphone inclus seulement s’il est lui-même vérifié ;
- étendre tous les scripts, Makefile et CI de miroirs après création du plugin ;
- régénérer séparément les contrats des deux frontends depuis le même OpenAPI.

## Risques dominants

- champs UUID devenus nullables sans mise à jour coordonnée de Zod et des permissions ;
- cookies partitionnés non supportés uniformément ;
- assertion réutilisable si audience et rejeu ne sont pas vérifiés ;
- CSP ou bloqueur empêchant le chargeur ;
- miroir du quatrième plugin oublié par la CI ;
- divergence des snapshots OpenAPI entre les deux dépôts.
