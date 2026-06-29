.PHONY: help up down restart logs ps build test lint clean db-push db-seed db-reset

# ============================================
# Telecom Ticket Management — Makefile
# ============================================

help: ## Affiche cette aide
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Docker ────────────────────────────────────────────

up: ## Démarre tous les services (DB, Redis, API, monitoring)
	docker compose up -d
	@echo "✅ Services démarrés: http://localhost:3000/api/v1"

down: ## Arrête tous les services
	docker compose down

restart: down up ## Redémarre tous les services

logs: ## Suit les logs de l'API
	docker compose logs -f api

ps: ## État des conteneurs
	docker compose ps

# ─── Base de données ──────────────────────────────────────

db-push: ## Pousse le schéma Drizzle vers PostgreSQL
	pnpm run db:push

db-seed: ## Insère les données de test
	pnpm run db:seed

db-reset: ## Réinitialise complètement la DB (⚠️ supprime tout)
	docker compose down postgres -v
	docker compose up -d postgres
	@echo "Attente PostgreSQL..."
	@sleep 5
	pnpm run db:push
	pnpm run db:seed
	@echo "✅ DB réinitialisée"

db-studio: ## Ouvre Drizzle Studio (interface visuelle)
	pnpm run db:studio

# ─── Développement ────────────────────────────────────────

dev: ## Démarre l'API en mode watch (hot-reload)
	pnpm run start:dev

build: ## Compile le projet TypeScript
	pnpm run build

start: ## Démarre l'API en production (après build)
	node dist/main.js

# ─── Qualité ──────────────────────────────────────────────

test: ## Lance tous les tests
	pnpm run test

test-watch: ## Lance les tests en mode watch
	pnpm run test:watch

test-cov: ## Lance les tests avec couverture
	pnpm run test:cov

test-e2e: ## Lance les tests end-to-end
	pnpm run test:e2e

lint: ## Vérifie le code avec ESLint
	pnpm run lint

format: ## Formate le code avec Prettier
	pnpm run format

# ─── Docker (complet) ─────────────────────────────────────

up-full: ## Démarre TOUS les services (API + monitoring)
	docker compose --profile full up -d
	@echo "✅ Services:"
	@echo "   API:       http://localhost:3000/api/v1"
	@echo "   Swagger:   http://localhost:3000/api/docs"
	@echo "   Grafana:   http://localhost:3001 (admin/admin)"
	@echo "   Prometheus: http://localhost:9090"
	@echo "   Mailpit:   http://localhost:8025"
	@echo "   Uptime Kuma: http://localhost:3002"

# ─── Nettoyage ────────────────────────────────────────────

clean: ## Nettoie les artefacts de build
	Remove-Item -Path "dist", "coverage" -Recurse -Force -ErrorAction SilentlyContinue
	@echo "✅ Nettoyé"
