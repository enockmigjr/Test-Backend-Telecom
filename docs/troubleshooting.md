# Troubleshooting

Guide de résolution des erreurs courantes du backend.

---

## Démarrage

### L'API ne démarre pas

```bash
# 1. Vérifier que PostgreSQL et Redis sont démarrés
docker compose ps
# postgres et redis doivent être "running"

# 2. Vérifier les ports
# Windows :
netstat -an | findstr "5432 6379"
# Linux/Mac :
ss -tlnp | grep -E '5432|6379'

# 3. Vérifier le fichier .env
cat .env
# DATABASE_URL doit pointer vers localhost:5432

# 4. Réinitialiser complètement
docker compose down -v
docker compose up -d postgres redis mailpit
# Attendre 5 secondes
pnpm run db:push
pnpm run db:seed
pnpm run start:dev
```

### Erreur « Connection refused » à PostgreSQL

```bash
# PostgreSQL n'est pas prêt. Attendre quelques secondes :
docker compose up -d postgres
# Attendre 5-10 secondes
pnpm run db:push
```

### Erreur « ECONNREFUSED 127.0.0.1:6379 » (Redis)

```bash
docker compose up -d redis
# Vérifier :
docker compose exec redis redis-cli PING
# Doit retourner "PONG"
```

---

## Authentification

### Erreur 401 Unauthorized

- Vérifier que le token est valide et non expiré (durée de vie : 15 min)
- Utiliser `POST /auth/refresh` pour obtenir un nouveau token
- Vérifier le header : `Authorization: Bearer <token>` (avec espace après Bearer)

### Erreur 429 Too Many Requests (Rate Limiting)

```bash
# Flusher le cache Redis (dev uniquement !)
docker compose exec redis redis-cli FLUSHALL
```

### « Invalid credentials » alors que le compte existe

1. Vérifier que le seed a été exécuté : `pnpm run db:seed`
2. Vérifier l'email exact (sensible à la casse du domaine)
3. Vérifier le mot de passe (voir README pour la liste complète)
4. Vérifier que l'utilisateur n'est pas désactivé (`is_active = true`)

---

## Base de données

### « relation "xxx" does not exist »

Le schéma n'a pas été poussé :

```bash
pnpm run db:push
```

### « duplicate key value violates unique constraint »

Le seed a déjà été exécuté. Réinitialiser :

```bash
pnpm run db:reset
# Équivalent à : db:push + db:seed
```

### Voir les données en base

```bash
pnpm run db:studio
# Ouvre Drizzle Studio sur https://local.drizzle.studio
```

---

## Emails

### Les emails n'arrivent pas

```bash
# 1. Vérifier que Mailpit tourne
docker compose up -d mailpit

# 2. Ouvrir l'interface Mailpit
# http://localhost:8025

# 3. Vérifier les variables SMTP dans .env
SMTP_HOST=localhost
SMTP_PORT=1025
```

### Erreur SMTP « connect ECONNREFUSED »

Mailpit n'est pas démarré :

```bash
docker compose up -d mailpit
```

---

## Tests

### Tests unitaires qui échouent

```bash
# Lancer avec plus de détails
pnpm run test:unit -- --verbose

# Lancer un seul fichier
pnpm run test -- src/modules/auth/auth.service.spec.ts
```

### Tests E2E qui échouent

```bash
# Les tests E2E nécessitent PostgreSQL + Redis
docker compose up -d postgres redis

# Pousser le schéma
pnpm run db:push

# Lancer les tests
pnpm run test:e2e
```

### « Cannot find module » dans les tests

```bash
# Reconstruire les dépendances
rm -rf node_modules
pnpm install
```

---

## BullMQ / Queues

### Les jobs ne sont pas traités

```bash
# 1. Vérifier que Redis tourne
docker compose exec redis redis-cli PING

# 2. Vérifier les queues via BullBoard
# http://localhost:3000/admin/queues
# Login : admin / bullboard

# 3. Vérifier les logs de l'API pour les erreurs de workers
```

### Jobs bloqués dans la queue

```bash
# Vider toutes les queues (dev uniquement !)
docker compose exec redis redis-cli FLUSHALL
```

---

## Docker

### « port is already allocated »

Un autre service utilise le même port :

```bash
# Trouver le processus (Windows)
netstat -ano | findstr "3000"
# Tuer le processus
taskkill /PID <pid> /F

# Ou changer le port dans .env
PORT=3001
```

### Volumes corrompus

```bash
docker compose down -v
docker compose up -d postgres redis mailpit
```

---

## WebSocket

### Les notifications WebSocket ne fonctionnent pas

1. Vérifier que le backend est démarré
2. Le WebSocket est sur le namespace `/ws` du même port (3000)
3. Vérifier l'authentification JWT du client WebSocket
4. Vérifier la variable `CORS_ORIGIN` inclut l'origine du frontend

---

## Monitoring (optionnel)

### Grafana ne se connecte pas

```bash
# Démarrer tous les services monitoring
make up-full
# ou
docker compose --profile full up -d

# Grafana : http://localhost:3001
# Login : admin / admin
```

### Prometheus n'a pas de données

- Les métriques sont exposées sur `http://localhost:3000/metrics`
- Vérifier que Prometheus scrape l'API dans `prometheus/prometheus.yml`
