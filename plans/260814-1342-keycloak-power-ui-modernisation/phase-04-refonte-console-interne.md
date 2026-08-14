# Phase 04 — Refonte console interne et activation du dark mode

## Statut
- Prévu — dépend de : D1 (marque), phase 01 (login page nettoyée).
- Références : `frontend/src/app/globals.css` (`.dark` défini l.223 mais jamais activé), `frontend/src/features/settings/preferences.ts` (retire toujours la classe `dark`), mentions visibles vérifiées (`user-menu.tsx:56-58`, `account-panel.tsx:83-88`, `login/page.tsx:14`).

## Contexte
La console interne est déjà Geist/Inter + shadcn/ui + Tailwind v4 avec des tokens type Vercel, mais le dark mode est mort (CSS présent, préférence absente) et trois textes visibles citent « Keycloak ». La refonte est une harmonisation (tokens, marque, dark, libellés), pas une réécriture fonctionnelle.

## Vue d'ensemble
1. Préférence `theme` (clair/sombre/système) persistée et appliquée.
2. Vérification/correction des tokens dark dans `globals.css`.
3. Suppression des mentions « Keycloak » visibles.
4. Marque unique + logo (D1) dans sidebar/topbar/login.
5. Polissage sobre des surfaces (shell, boutons, cartes) sans refonte métier.

## Exigences
- `preferences.ts` : migration du stockage v2 → v3 (lecture de la clé `kamgoko.interface-preferences.v2` si v3 absente) ; `theme` = `'light' | 'dark' | 'system'` ; `applyPreferences` pose/retire la classe `dark` et écoute `matchMedia` pour `system`.
- Aucune mention « Keycloak » dans les textes visibles (Gate E).
- Contraste AA minimum en dark (axe), `color-scheme` déclaré.
- Aucun changement de contrat/API.

## Architecture
- **Préférences** : étendre `InterfacePreferences` (champ `theme`) ; `savePreferences` écrit le cookie `theme` (délai 1 an) pour éviter le flash au premier rendu ; `InterfacePreferencesSync` applique la résolution système.
- **Dark tokens** : compléter le bloc `.dark` existant de `globals.css` (surfaces, bordures, `oklch`), ajouter `color-scheme: dark`, vérifier les composants shadcn déjà compatibles (`dark:` utilisés dans `preference-panel.tsx`).
- **Libellés** : « Compte et mot de passe (Keycloak) » → « Compte et sécurité » ; « gérés par Keycloak » → « gérés par votre compte professionnel » ; dialog logout-all sans « Keycloak » ; page login = écran de redirection sobre vers le SSO (aucun fallback).
- **Marque** : sidebar (`app-sidebar.tsx`), topbar (`app-topbar.tsx`), page login : « KAMGOKO ITSM » + logo (D1), en remplacement du bloc `RadioTower` + « KAMGOKO / Operations Desk » si D1 le confirme.

## Étapes
1. `preferences.ts` : ajouter `theme`, migration v2→v3, application `dark`/`system` ; adapter `preference-panel.tsx` (RadioGroup « Clair / Sombre / Système ») et `settings-page.tsx` si besoin.
2. `globals.css` : activer/corriger `.dark`, `color-scheme`, contrastes (notamment inputs, muted, sidebar) ; vérifier `layout.tsx` (meta theme-color).
3. `user-menu.tsx`, `account-panel.tsx` : remplacer les libellés et descriptions ; supprimer la mention dans le ConfirmDialog.
4. `login/page.tsx` : page de redirection marquée (D1), zéro « Keycloak » ; si `AUTH_PROVIDER` déjà retiré (phase 01), suppression du fallback.
5. Marque : `app-sidebar.tsx`, `app-topbar.tsx`, `navigation.ts` (intitulés inchangés sauf D1) ; composant logo réutilisable `frontend/src/components/brand.tsx` si absent.
6. Polissage : `app-shell.tsx`, cartes/boutons via tokens existants uniquement (pas de nouveau design system).
7. Tests : jest (migration v2→v3, résolution system/dark) dans `frontend/test/features/settings/preferences.spec.ts` (créer), Playwright (`frontend/e2e/theme.spec.ts`, `frontend/e2e/no-keycloak-text.spec.ts` — à créer) : toggle → classe `dark` persistée, axe sur dashboard/settings, `rg` textes rendus = zéro « Keycloak » ; screenshots clair + sombre.

## Fichiers
- **Modifier** : `frontend/src/features/settings/preferences.ts`, `frontend/src/features/settings/preference-panel.tsx`, `frontend/src/app/globals.css`, `frontend/src/app/layout.tsx`, `frontend/src/components/layout/user-menu.tsx`, `frontend/src/features/settings/account-panel.tsx`, `frontend/src/app/(auth)/login/page.tsx`, `frontend/src/components/layout/app-sidebar.tsx`, `frontend/src/components/layout/app-topbar.tsx`, `frontend/src/components/layout/app-shell.tsx`, `frontend/src/components/layout/navigation.ts` (si D1).
- **Créer** : `frontend/src/components/brand.tsx` (si absent), `frontend/test/features/settings/preferences.spec.ts`, `frontend/e2e/theme.spec.ts`, `frontend/e2e/no-keycloak-text.spec.ts`.

## Todo et tests
- [ ] Migration v2→v3 testée (ancienne clé lue, nouvelle écrite)
- [ ] Toggle clair/sombre/système fonctionnel et persistant (localStorage + cookie)
- [ ] `.dark` appliqué réellement (classe sur `<html>`, `color-scheme: dark`)
- [ ] Axe : zéro violation AA sur dashboard + settings (clair et sombre)
- [ ] Zéro « Keycloak » dans le DOM console (Playwright)
- [ ] Marque D1 affichée sidebar/topbar/login
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` verts ; `contract:check` vert

## Critères de succès
- Gate E console atteinte : dark mode réel et accessible, mentions Keycloak disparues, marque cohérente.
- Aucune page métier refaite fonctionnellement (YAGNI) ; contrat inchangé.
