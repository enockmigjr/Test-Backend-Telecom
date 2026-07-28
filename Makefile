.PHONY: help up down restart logs ps build test lint clean db-push db-seed db-reset dev start test-watch test-cov test-e2e format up-full db-studio

# ============================================
# Telecom Ticket Management — Makefile
# ============================================
# Usage: make <commande>
# Exécuter `make help` pour voir toutes les commandes.
# ============================================

help: ## Affiche cette aide
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Docker ────────────────────────────────────────────

up: ## Démarre les services essentiels (PostgreSQL, Redis, Mailpit)
	docker compose up -d postgres redis mailpit
	@echo "✅ Services essentiels démarrés"
	@echo "   PostgreSQL:  localhost:$${DATABASE_PORT:-5432}"
	@echo "   Redis:       localhost:$${REDIS_PORT:-6379}"
	@echo "   Mailpit:     http://localhost:$${MAILPIT_WEB_PORT:-8025}"

up-full: ## Démarre TOUS les services (API + monitoring complet)
	docker compose --profile full up -d
	@echo "✅ Services complets démarrés:"
	@echo "   API:         http://localhost:$${API_PORT:-3000}/$${API_PREFIX:-api/v1}"
	@echo "   Swagger:     http://localhost:$${API_PORT:-3000}/api/docs"
	@echo "   Grafana:     http://localhost:$${GRAFANA_PORT:-3001} ($${GRAFANA_ADMIN_USER:-admin}/$${GRAFANA_ADMIN_PASSWORD:-admin})"
	@echo "   Prometheus:  http://localhost:$${PROMETHEUS_PORT:-9090}"
	@echo "   Mailpit:     http://localhost:$${MAILPIT_WEB_PORT:-8025}"
	@echo "   BullBoard:   http://localhost:$${API_PORT:-3000}/admin/queues"
	@echo "   Uptime Kuma: http://localhost:3002"

down: ## Arrête tous les services
	docker compose down

restart: down up ## Redémarre les services essentiels

logs: ## Suit les logs de l'API
	docker compose logs -f api

ps: ## État des conteneurs
	docker compose ps

# ─── Base de données ──────────────────────────────────────

db-push: ## Pousse le schéma Drizzle vers PostgreSQL
	pnpm run db:push

db-seed: ## Insère les données de test (14 utilisateurs, tickets, SLA)
	pnpm run db:seed

db-reset: ## Réinitialise complètement la DB (⚠️ supprime tout)
	docker compose down postgres -v
	docker compose up -d postgres
	@echo "Attente PostgreSQL..."
	@sleep 5
	pnpm run db:push
	pnpm run db:seed
	@echo "✅ DB réinitialisée (schéma + seed)"

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

test: ## Lance les tests unitaires
	pnpm run test

test-watch: ## Lance les tests en mode watch
	pnpm run test:watch

test-cov: ## Lance les tests avec couverture
	pnpm run test:cov

test-e2e: ## Lance les tests end-to-end (110 tests)
	pnpm run test:e2e

test-all: ## Lance TOUS les tests (unitaires + E2E + intégration = 563)
	pnpm run test:all

lint: ## Vérifie le code avec ESLint
	pnpm run lint

format: ## Formate le code avec Prettier
	pnpm run format

# ─── Nettoyage ────────────────────────────────────────────

clean: ## Nettoie les artefacts de build (dist/, coverage/)
	@if exist dist rmdir /s /q dist
	@if exist coverage rmdir /s /q coverage
	@echo "✅ Nettoyé (dist/ et coverage/)"
