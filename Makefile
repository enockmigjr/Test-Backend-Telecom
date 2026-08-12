# ============================================================================
# Makefile DevOps — Plateforme Telecom Ticket Management
# Usage : make <cible>  (lire `make help`)
# Nécessite : docker compose, pnpm, make.
# ============================================================================

SHELL := /bin/sh
COMPOSE ?= docker compose
API ?= api

.PHONY: help env up down build restart logs ps health migrate seed db-reset \
	test unit e2e lint typecheck openapi \
	api-logs db-shell redis-shell mailpit clean

help: ## Affiche les cibles disponibles
	@echo "Cibles principales :"
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk -F'[:#]' '{printf "  make %-14s %s\n", $$1, $$3}'

env: ## Prépare .env depuis .env.example (ne remplace pas un .env existant)
	@test -f .env || cp .env.example .env
	@test -f .env && echo "Fichier .env prêt."

up: ## Démarre toute la stack en arrière-plan
	$(COMPOSE) up -d

down: ## Arrête la stack (sans supprimer les volumes)
	$(COMPOSE) down

build: ## Reconstruit les images puis démarre la stack
	$(COMPOSE) up -d --build

restart: ## Redémarre l'API et le portail public
	$(COMPOSE) restart $(API) public-frontend

logs: ## Suit les logs de l'API
	$(COMPOSE) logs -f --tail=100 $(API)

api-logs: ## Alias de logs
	$(COMPOSE) logs -f --tail=100 $(API)

ps: ## Liste les conteneurs et leur état
	$(COMPOSE) ps

health: ## Vérifie la santé de la stack
	$(COMPOSE) ps --format "table {{.Name}}\t{{.Status}}"

migrate: ## Applique les migrations de base de données
	$(COMPOSE) exec $(API) pnpm db:migrate

seed: ## Charge les données de démonstration
	$(COMPOSE) exec $(API) pnpm db:seed

db-reset: ## Réinitialise le schéma et recharge le seed
	$(COMPOSE) exec $(API) pnpm db:reset

test: ## Lance toute la suite de tests backend (unitaires + e2e + intégration)
	pnpm test:all

unit: ## Tests unitaires backend uniquement
	pnpm test:unit

e2e: ## Tests e2e backend
	pnpm test:e2e

lint: ## Lint backend (avec correction automatique)
	pnpm lint

typecheck: ## Vérification TypeScript stricte du backend
	pnpm exec tsc --noEmit -p tsconfig.json

openapi: ## Régénère les contrats OpenAPI (interne + public)
	pnpm openapi:export

db-shell: ## Ouvre psql dans le conteneur PostgreSQL
	$(COMPOSE) exec postgres psql -U telecom -d telecom_tickets

redis-shell: ## Ouvre redis-cli dans le conteneur Redis
	$(COMPOSE) exec redis redis-cli

mailpit: ## Ouvre l'interface Mailpit (http://localhost:9025)
	@echo "Mailpit : http://localhost:9025"

clean: ## Supprime conteneurs et volumes (⚠️ détruit les données)
	@echo "ATTENTION : cette cible supprime les volumes de données."
	@read -p "Taper DELETE pour confirmer : " ans && [ "$$ans" = "DELETE" ] && $(COMPOSE) down -v || echo "Annulé."
