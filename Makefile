# ============================================================================
# Makefile DevOps — Plateforme Telecom Ticket Management
# Usage : make <cible>  (lire `make help`)
# Nécessite : docker compose, pnpm, make.
# ============================================================================

SHELL := /bin/sh
COMPOSE ?= docker compose
API ?= api

.PHONY: help env up down build restart logs ps health migrate seed db-reset keycloak-seed publish \
	test unit e2e lint typecheck openapi \
	api-logs db-shell redis-shell mailpit backup restore clean

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

keycloak-up: ## Démarre Keycloak avec le realm importé
	$(COMPOSE) up -d keycloak

keycloak-seed: ## Crée 100+ comptes dans Keycloak
	KEYCLOAK_ADMIN=$(KEYCLOAK_ADMIN) KEYCLOAK_ADMIN_PASSWORD=$(KEYCLOAK_ADMIN_PASSWORD) node keycloak/seed-users.mjs

publish: ## Publie les images backend et portail sur le registry (REGISTRY/TAG)
	@test -n "$(REGISTRY)" || (echo "Précisez REGISTRY=registry.example.com" && exit 1)
	@docker tag testbackendtelecom-api $(REGISTRY)/telecom-api:$(TAG)
	@docker tag testbackendtelecom-public-frontend $(REGISTRY)/telecom-public-frontend:$(TAG)
	@docker push $(REGISTRY)/telecom-api:$(TAG)
	@docker push $(REGISTRY)/telecom-public-frontend:$(TAG)
	@echo "Images publiées : $(REGISTRY)/telecom-api:$(TAG), $(REGISTRY)/telecom-public-frontend:$(TAG)"

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

backup: ## Sauvegarde PostgreSQL dans backups/
	@mkdir -p backups
	@docker exec telecom-postgres pg_dump -U telecom -d telecom_tickets -F c -f /tmp/telecom-backup.dump
	@docker cp telecom-postgres:/tmp/telecom-backup.dump backups/telecom-$(shell date +%Y%m%d-%H%M%S).dump
	@docker exec telecom-postgres rm -f /tmp/telecom-backup.dump
	@echo "Sauvegarde créée dans backups/"

restore: ## Restaure un dump (usage : make restore FILE=backups/xxx.dump)
	@test -n "$(FILE)" || (echo "Précisez FILE=backups/xxx.dump" && exit 1)
	@docker cp "$(FILE)" telecom-postgres:/tmp/telecom-restore.dump
	@docker exec telecom-postgres pg_restore -U telecom -d telecom_tickets --clean --if-exists /tmp/telecom-restore.dump
	@docker exec telecom-postgres rm -f /tmp/telecom-restore.dump
	@echo "Restauration terminée."

clean: ## Supprime conteneurs et volumes (⚠️ détruit les données)
	@echo "ATTENTION : cette cible supprime les volumes de données."
	@read -p "Taper DELETE pour confirmer : " ans && [ "$$ans" = "DELETE" ] && $(COMPOSE) down -v || echo "Annulé."
