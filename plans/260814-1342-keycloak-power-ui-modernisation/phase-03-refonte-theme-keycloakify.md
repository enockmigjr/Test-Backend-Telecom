# Phase 03 — Refonte du thème Keycloakify (login + console de compte)

## Statut
- Prévu — dépend de : D1 (marque, actée), phase 01 (script storybook supprimé). Indépendant de la phase 02 (aucun écran OTP/passkey à créer — hors périmètre).
- Références : `keycloak-theme/` (Keycloakify v11, React 18, Vite 6), `keycloak-theme/Dockerfile` (image 26.7.1).

## Contexte
Les pages custom existent (`Login`, `Info`, `Error`, `LoginUpdatePassword`, `account/Template`) mais la marque est incohérente : « Telecom Ticket Management » au login vs « Helpdesk Telecom » dans la console de compte, pas de logo, footer « SSO sécurisé ». Les pages de compte non overridées (password, authenticator, sessions…) utilisent les gabarits Keycloakify par défaut : risque de textes « Keycloak » visibles.

## Vue d'ensemble
1. Marque unique (D1) + logo dans toutes les pages.
2. Rafraîchissement des styles type Vercel (tokens, focus, dark via `prefers-color-scheme`).
3. Suppression du script `storybook` mort.
4. Vérification DOM : zéro « Keycloak » visible sur login, update-password, error, account.
5. Rebuild image + tests runtime.

## Exigences
- Aucun texte « Keycloak » dans le DOM rendu (Gate D) ; « SSO sécurisé » peut rester.
- Nom de marque unique sur login ET account (D1).
- Thème < 200 lignes par fichier ; `styles.css` découpé si nécessaire.
- Compatible Keycloakify v11 : pages importées depuis `keycloak-theme/src/pages/*`, `kc.gen.tsx` inchangé.

## Architecture
- **Marque** : composant partagé `keycloak-theme/src/components/brand.tsx` (SVG inline + wordmark, aucune dépendance asset build) importé par les 4 pages login et le gabarit account ; `logo.png` racine conservé pour les consoles (phase 04) — D1 tranche.
- **Styles** : garder la charte existante (bleu nuit `#172033`, accent `#1d4ed8`) ; ajouter focus ring visible, espacements et ombres alignés `globals.css` frontend ; dark mode via variables CSS `@media (prefers-color-scheme: dark)` (tokens `.dark` déjà définis côté console, à dupliquer volontairement ici — les thèmes Keycloakify et Next.js ne partagent pas de bundle).
- **i18n** : si les gabarits par défaut affichent « Keycloak »/« Account Management », les remplacer par des overrides dans `keycloak-theme/src/login/i18n.ts` et `keycloak-theme/src/account/i18n.ts` (messages fr/en).
- **Build** : `pnpm install` (lockfile à jour après suppression du script), `pnpm run build-keycloak-theme`, `docker compose build keycloak`, puis tests navigateur contre `http://localhost:8081`.

## Étapes
1. Créer `keycloak-theme/src/components/brand.tsx` (logo + marque selon D1).
2. Modifier `keycloak-theme/src/pages/Login.tsx`, `Info.tsx`, `Error.tsx`, `LoginUpdatePassword.tsx`, `keycloak-theme/src/account/Template.tsx` : remplacer les marques et footers par le composant, libellés « Compte et sécurité » cohérents.
3. Modifier `keycloak-theme/src/styles.css` : tokens type Vercel, focus, dark media query ; si > 200 lignes, découper en `login-styles.css` / `account-styles.css` importés par `keycloak-theme/src/main.tsx`.
4. Supprimer la ligne `"storybook": "storybook dev -p 6006"` de `keycloak-theme/package.json` ; `pnpm install --lockfile-only` puis `pnpm install` pour synchroniser `pnpm-lock.yaml`.
5. Vérifier/override les messages i18n par défaut contenant « Keycloak ».
6. `pnpm run build-keycloak-theme` puis `docker compose build keycloak` ; relancer `docker compose up -d keycloak`.
7. Tests runtime : login, login-update-password (mot de passe temporaire), info, error, account (profil, mot de passe, onglet authenticator existant, sessions, applications) ; capturer des screenshots dans `plans/reports/` ; lancer une recherche « Keycloak » sur le DOM rendu (Playwright) et sur les sources visibles (`rg` sur textes rendus). Aucun écran OTP/passkey supplémentaire n'est à créer (périmètre réduit).

## Fichiers
- **Modifier** : `keycloak-theme/src/pages/Login.tsx`, `keycloak-theme/src/pages/Info.tsx`, `keycloak-theme/src/pages/Error.tsx`, `keycloak-theme/src/pages/LoginUpdatePassword.tsx`, `keycloak-theme/src/account/Template.tsx`, `keycloak-theme/src/styles.css`, `keycloak-theme/src/login/i18n.ts`, `keycloak-theme/src/account/i18n.ts`, `keycloak-theme/src/main.tsx` (si découpage CSS), `keycloak-theme/package.json`, `pnpm-lock.yaml`.
- **Créer** : `keycloak-theme/src/components/brand.tsx`, `keycloak-theme/src/login-styles.css` / `keycloak-theme/src/account-styles.css` (si nécessaire), screenshots dans `plans/reports/`.
- **Supprimer** : aucun fichier de code (script supprimé dans `package.json`).

## Todo et tests
- [ ] Marque unique affichée login + account (D1 appliqué)
- [ ] Zéro « Keycloak » dans le DOM (Playwright, toutes les pages) — Gate D
- [ ] Contrastes AAA/AA validés (axe) en clair et en dark (media query)
- [ ] Onglet authenticator existant rendu sans texte « Keycloak » (gabarit par défaut contrôlé)
- [ ] `pnpm run build-keycloak-theme` vert ; image `telecom-keycloak` rebuildée
- [ ] Screenshots enregistrés dans `plans/reports/`

## Critères de succès
- Gate D atteinte : aucun texte « Keycloak » visible, marque unique, image rebuildée et parcours login/account testés au runtime.
- Aucun changement fonctionnel du flux SSO (PKCE, logout, update-password).
