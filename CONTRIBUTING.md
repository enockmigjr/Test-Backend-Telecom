# Guide de Contribution

## Démarrage rapide pour les nouveaux développeurs

### 1. Prérequis

- Node.js ≥ 18, pnpm ≥ 8, Docker ≥ 24
- Git configuré

### 2. Setup initial

```bash
git clone <url>
cd Test-Backend-Telecom
pnpm install
cp .env.example .env
docker compose up -d postgres redis mailpit
pnpm run db:push && pnpm run db:seed
pnpm run start:dev
```

### 3. Vérification

```bash
# L'API doit répondre
curl http://localhost:3000/api/v1/health/ready

# Les tests doivent passer
pnpm run test:unit
```

---

## Conventions de code

### Nommage de fichiers

- **kebab-case** uniquement : `ticket-assignment.service.ts` ✅ et non `ticketAssignment.service.ts` ❌
- **Fichiers < 200 lignes** : découper si plus grand

### Structure des modules NestJS

Chaque module suit la structure :

```
src/modules/<nom>/
├── <nom>.module.ts           # Déclaration du module
├── <nom>.controller.ts       # Routes REST
├── <nom>.service.ts          # Logique métier
├── dto/                      # Data Transfer Objects
│   ├── create-<nom>.dto.ts
│   └── update-<nom>.dto.ts
├── <nom>.controller.spec.ts  # Tests unitaires controller
└── <nom>.service.spec.ts     # Tests unitaires service
```

### TypeScript strict

- ❌ Jamais de `any`
- ❌ Jamais de `@ts-ignore`
- ✅ Typage explicite des retours de fonctions publiques
- ✅ `readonly` quand possible

### Tests

- Tests unitaires dans `src/` (fichiers `*.spec.ts`)
- Tests E2E dans `test/` (fichiers `*.e2e-spec.ts`)
- Tests d'intégration dans `test/` (fichiers `*.integration.spec.ts`)

```bash
pnpm run test:unit      # Unitaires
pnpm run test:e2e       # E2E
pnpm run test:all       # Tout
```

### Commits

Format conventionnel :

```
<type>(<scope>): <description>

Types: feat, fix, docs, refactor, test, chore
Scope: auth, tickets, sla, dashboard, docs, etc.

Exemples:
feat(tickets): add pending-third-party status
fix(sla): correct business hours calculation
docs: update README with test accounts
```

---

## Architecture — Règles clés

1. **Logique métier dans les services**, jamais dans les contrôleurs
2. **Contrôleurs minces** : valident la requête, appellent le service, retournent la réponse
3. **Événements domaine** via `EventEmitter2` pour le découplage (notifications, audit, SLA)
4. **Pas de dépendances circulaires** : utiliser `forwardRef` si nécessaire
5. **Soft delete** : ne jamais supprimer physiquement (users, tickets, departments)
6. **UUIDv7** pour toutes les clés primaires

---

## Variables d'environnement

Voir `.env.example` pour la liste complète (70+ variables).

Les valeurs par défaut fonctionnent en local. En production, au minimum changer :

- `KEYCLOAK_ADMIN_PASSWORD` (provisionnement/révocation SSO)
- `PUBLIC_SESSION_SECRET` (≥ 32 caractères)
- `DATABASE_PASSWORD`
- `REDIS_PASSWORD`
- `SMTP_*` (configuration SMTP réelle)

---

## Branches et PR

```
main           ← branche stable
  └── feat/*   ← nouvelles fonctionnalités
  └── fix/*    ← corrections de bugs
  └── docs/*   ← documentation
```

Avant de merge :

- [ ] `pnpm run lint` passe
- [ ] `pnpm run test:unit` passe
- [ ] `pnpm run build` compile sans erreur
