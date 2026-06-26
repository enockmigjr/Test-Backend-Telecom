# Système de Gestion des Tickets d'Incidents Télécom

Backend NestJS pour la gestion des tickets d'incidents d'une entreprise de télécommunications.

## Stack Technique

| Couche | Technologie |
|--------|------------|
| Framework | NestJS (Node.js) |
| Base de données | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Cache | Redis 7 |
| Queue | BullMQ |
| Auth | JWT (access + refresh rotation) · Argon2id |
| Validation | class-validator · class-transformer |
| Temps réel | Socket.io |
| Logging | Pino |
| Docs API | Swagger/OpenAPI |
| Containerisation | Docker Compose |

## Démarrage Rapide

```bash
# 1. Installer les dépendances
pnpm install

# 2. Lancer les services (PostgreSQL, Redis, Mailpit)
docker compose up -d postgres redis mailpit

# 3. Copier les variables d'environnement
cp .env.example .env

# 4. Pousser le schéma de base de données
pnpm run db:push

# 5. Lancer les seeds
pnpm run db:seed

# 6. Démarrer l'API en développement
pnpm run start:dev
```

L'API est disponible sur `http://localhost:3000/api/v1`
La documentation Swagger sur `http://localhost:3000/api/docs`

## Comptes de Test (Seed)

| Email | Rôle | Mot de passe |
|-------|------|-------------|
| admin@telecom.local | ADMINISTRATOR | Admin@1234 |
| supervisor@telecom.local | SUPERVISOR | Super@1234 |
| agent-cc@telecom.local | CUSTOMER_SERVICE_AGENT | Agent@1234 |
| noc@telecom.local | NOC_ENGINEER | Agent@1234 |
| billing@telecom.local | BILLING_AGENT | Agent@1234 |
| tech@telecom.local | TECHNICAL_SUPPORT_ENGINEER | Agent@1234 |
| field@telecom.local | FIELD_TECHNICIAN | Agent@1234 |

## Structure du Projet

```
src/
├── main.ts                    # Point d'entrée
├── app.module.ts              # Module racine
├── config/                    # Configuration (env vars, DB, JWT, Redis)
├── common/                    # Code partagé (filtres, intercepteurs, middleware, DTOs)
├── database/
│   ├── schemas/               # 12 tables Drizzle ORM + 6 ENUMs PostgreSQL
│   ├── migrations/            # Migrations Drizzle
│   └── seed/                  # Données initiales
├── modules/
│   ├── auth/                  # Authentification JWT
│   ├── users/                 # Gestion des utilisateurs
│   ├── departments/           # Gestion des départements
│   ├── tickets/               # Gestion des tickets (cœur métier)
│   ├── comments/              # Commentaires publics
│   ├── internal-notes/        # Notes internes
│   ├── attachments/           # Pièces jointes
│   ├── notifications/         # Notifications
│   ├── sla/                   # Politiques SLA et moteur
│   ├── dashboard/             # Tableaux de bord
│   └── audit-logs/            # Journaux d'audit
├── queues/                    # BullMQ queues
└── websocket/                 # Socket.io gateway
```

## RBAC — Matrice des Permissions

| Action | Agent | NOC | Billing | Support | Field | Supervisor | Admin |
|--------|:----:|:---:|:-------:|:-------:|:-----:|:----------:|:-----:|
| Créer ticket | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Modifier ticket | Assigné | Assigné | Assigné | Assigné | Assigné | ✅ | ✅ |
| Assigner/Escalader | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Résoudre ticket | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Clôturer/Réouvrir | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Notes internes | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Audit Logs | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Gestion utilisateurs | ❌ | ❌ | ❌ | ❌ | ❌ | Partiel | ✅ |

## Cycle de Vie d'un Ticket

```
NEW → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
                      ↓               ↓
              PENDING_CUSTOMER    REOPENED
              PENDING_THIRD_PARTY
```

## Endpoints Principaux

### Auth
- `POST /api/v1/auth/login` — Connexion
- `POST /api/v1/auth/refresh` — Rafraîchir les tokens
- `POST /api/v1/auth/logout` — Déconnexion

### Tickets
- `POST /api/v1/tickets` — Créer un ticket
- `GET /api/v1/tickets` — Rechercher des tickets
- `GET /api/v1/tickets/:id` — Détails d'un ticket
- `POST /api/v1/tickets/:id/assign` — Assigner
- `POST /api/v1/tickets/:id/escalate` — Escalader
- `POST /api/v1/tickets/:id/resolve` — Résoudre
- `POST /api/v1/tickets/:id/close` — Clôturer
- `GET /api/v1/tickets/:id/history` — Historique

### Dashboard (Supervisor/Admin)
- `GET /api/v1/dashboard/overview` — KPIs globaux
- `GET /api/v1/dashboard/departments` — Performance par département
- `GET /api/v1/dashboard/workload` — Charge des agents

## Scripts NPM

| Commande | Description |
|----------|-------------|
| `pnpm run start:dev` | Développement avec hot-reload |
| `pnpm run build` | Build production |
| `pnpm run test` | Tests unitaires |
| `pnpm run test:e2e` | Tests end-to-end |
| `pnpm run db:push` | Pousser le schéma vers PostgreSQL |
| `pnpm run db:generate` | Générer les migrations |
| `pnpm run db:seed` | Insérer les données de test |
| `pnpm run lint` | Linter TypeScript |

## Services Docker

```bash
docker compose up -d    # Tous les services
docker compose ps       # Vérifier l'état
docker compose logs api # Logs de l'API
```

Services disponibles :
- API NestJS : `http://localhost:3000`
- Swagger : `http://localhost:3000/api/docs`
- Mailpit (emails) : `http://localhost:8025`
- PostgreSQL : `localhost:5432`
- Redis : `localhost:6379`

## Pour lancer le projet

```bash
# 1. Installer (deja fait)
pnpm install

# 2. Approuver les build scripts (une fois)
pnpm approve-builds

# 3. Lancer PostgreSQL + Redis
docker compose up -d postgres redis mailpit

# 4. Pousser le schema DB
pnpm run db:push

# 5. Inserer les seeds
pnpm run db:seed

# 6. Demarrer l'API
pnpm run start:dev
```
#Fin