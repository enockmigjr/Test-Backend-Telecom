# Phase 2 et Phase 3 — Walking skeleton et fondations UI

## Objectif

Prouver un flux vertical contre le backend réel avant de construire un design system large ou toutes les pages.

## Phase 2 — Walking skeleton

### Scaffold minimal

- Next.js App Router, TypeScript strict, alias de chemins et variables validées au démarrage.
- Tailwind CSS 4 via `@tailwindcss/postcss` et `@import "tailwindcss"`; aucun autoprefixer séparé.
- Base UI pour les primitives réellement nécessaires au premier flux.
- Axios avec timeout, `AbortSignal`, normalisation d'erreur et correlation ID.
- TanStack Query avec query keys par feature et retry limité aux lectures transitoires.
- React Hook Form + Zod pour login et première mutation.
- Jest/Testing Library et Playwright; lint, typecheck, test et build dans la CI.

### Flux vertical à prouver

1. Login sécurisé via le BFF.
2. Lecture de l'identité courante et redirection `mustChangePassword` si nécessaire.
3. Shell minimal avec navigation autorisée.
4. Liste paginée de tickets.
5. Détail d'un ticket.
6. Une mutation idempotente, par exemple démarrer ou assigner selon le rôle de test.
7. Réception d'un événement WebSocket et invalidation ciblée.
8. Refresh access expiré, 403, offline, reconnexion et logout.

### Règles d'état

- URL comme source de vérité pour page, filtres, tri et vue.
- TanStack Query comme source de vérité des données serveur.
- État React local pour overlays et interactions ponctuelles.
- Pas de Zustand tant que le workspace multi-onglets n'est pas construit.
- Le realtime invalide/refetch; il n'applique pas aveuglément un payload non versionné.

### Critères d'acceptation

- E2E réel contre le backend local, sans MSW pour le happy path.
- Scénarios access expiré, 403 et reconnexion WebSocket couverts.
- Aucun token dans localStorage, URL, logs ou analytics.
- Aucune mutation réessayée automatiquement.
- Aucun `any` dans le code applicatif; code généré isolé et non édité.

## Phase 3 — Fondations UI émergentes

### Tokens

- Couleurs sémantiques : surface, texte, bordure, accent, succès, alerte, critique, information.
- Échelles contrôlées : spacing, typographie, radius, ombres et hauteurs de contrôle.
- Geist Sans pour l'interface et Geist Mono pour identifiants, durées et valeurs techniques.
- Mode light prioritaire; dark mode non bloquant et non inclus sans validation.

### Primitives initiales

- Button, IconButton, Field, Input, Textarea, Select, Combobox.
- Dialog, AlertDialog, Popover, Menu, Tooltip et Toast Base UI.
- Table, Pagination, Skeleton structurel, EmptyState et ErrorState.
- Badge de statut, priorité, sévérité, rôle et département.
- CopyButton, VisuallyHidden, focus ring et skip link.

### Composants métier issus du flux

- AppShell, Sidebar, Topbar, UserMenu et NotificationBell.
- TicketTable, TicketHeader, TicketActions et SlaIndicator.
- ApiErrorPanel avec correlation ID copiable.
- RealtimeStatus et StaleDataIndicator.

### Permissions frontend

- Fonctions pures retournant `{ allowed, reason }` pour l'UX.
- Sources : rôle, département, ownership, assignation et statut.
- La permission UI est un indice ergonomique; le backend reste autoritaire.
- Tout 403 conserve l'état utile et explique la prochaine action.
- Une capacité backend `allowedActions` reste une amélioration souhaitable, non un prérequis absolu.

### Accessibilité par défaut

- HTML sémantique, navigation clavier, focus visible et restitution du focus.
- Messages reliés aux champs et régions `aria-live` limitées aux changements importants.
- Statuts par icône + libellé + couleur, jamais par couleur seule.
- Reduced motion et zoom 200 % vérifiés sur le flux vertical.

### Critères d'acceptation

- Storybook seulement pour primitives et composants métier critiques.
- Chaque composant livré documente loading, error, empty, disabled et read-only pertinents.
- Test composant, axe automatisé et test clavier sur les éléments interactifs critiques.
