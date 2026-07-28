# Guide de Démarrage Rapide

Guide pas à pas pour démarrer le projet en moins de 5 minutes.

---

## Prérequis

- **Node.js** ≥ 18 ([télécharger](https://nodejs.org/))
- **pnpm** ≥ 8 (`npm install -g pnpm`)
- **Docker** ≥ 24 + **Docker Compose** ≥ 2.20 ([télécharger](https://docs.docker.com/get-docker/))

Vérifier :

```bash
node -v       # v18.x ou supérieur
pnpm -v       # 8.x ou supérieur
docker -v     # Docker version 24.x+
docker compose version  # v2.20+
```

---

## Étape 1 — Cloner le dépôt

```bash
git clone <url-du-repo>
cd Test-Backend-Telecom
```

## Étape 2 — Installer les dépendances

```bash
pnpm install
```

> ⚠️ Toujours utiliser `pnpm`, jamais `npm` ni `yarn`.

## Étape 3 — Configurer l'environnement

```bash
cp .env.example .env
```

Les valeurs par défaut fonctionnent immédiatement en local. Aucune modification requise.

## Étape 4 — Démarrer PostgreSQL, Redis et Mailpit

```bash
docker compose up -d postgres redis mailpit
```

Attendre ~5 secondes que les services soient prêts.

## Étape 5 — Initialiser la base de données

```bash
pnpm run db:push    # Pousser le schéma Drizzle
pnpm run db:seed    # Insérer 14 utilisateurs de test + données
```

## Étape 6 — Lancer l'API

```bash
pnpm run start:dev
```

## Étape 7 — Vérifier

```bash
# L'API doit répondre
curl http://localhost:3000/api/v1/health/ready
# → { "status": "ok", ... }

# Se connecter en tant qu'admin
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@telecom.local","password":"Admin@1234"}'
```

---

## URLs importantes

| Service    | URL                                  | Identifiants        |
| ---------- | ------------------------------------ | ------------------- |
| API REST   | `http://localhost:3000/api/v1`       | Bearer JWT          |
| Swagger    | `http://localhost:3000/api/docs`     | Aucun               |
| BullBoard  | `http://localhost:3000/admin/queues` | `admin`/`bullboard` |
| Mailpit    | `http://localhost:8025`              | Aucun               |

---

## Avec le frontend (optionnel)

### Frontend externe (SPA)

```bash
cd "../Test frontend Telecom"
pnpm install
cp .env.example .env.local
pnpm dev -p 3001
# → http://localhost:3001
```

### Frontend embarqué (BFF)

```bash
cd frontend
pnpm install
pnpm dev
# → http://localhost:3001
```

---

## Réinitialiser tout

```bash
docker compose down -v           # Supprimer les volumes Docker
docker compose up -d postgres redis mailpit
# Attendre 5 secondes
pnpm run db:push
pnpm run db:seed
pnpm run start:dev
```
