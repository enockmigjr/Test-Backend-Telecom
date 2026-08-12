# ============================================================================
# Makefile DevOps — Plateforme Telecom Ticket Management
# Usage : make <cible>  (lire `make help`)
# Nécessite : docker compose, pnpm, make.
# ============================================================================

SHELL := /bin/sh
COMPOSE ?= docker compose
API ?= api
KEYCLOAK_ADMIN ?= admin
KEYCLOAK_ADMIN_PASSWORD ?= Admin@1234

.PHONY: help env up down build restart logs ps health migrate seed db-reset keycloak-seed publish \
	test unit e2e lint typecheck openapi \
	api-logs db-shell redis-shell mailpit backup restore clean accounts \
	keycloak-db keycloak-up prod-up prod-down prod-build

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

restart: ## Redémarre l'API, le frontend interne et le portail public
	$(COMPOSE) restart $(API) frontend public-frontend

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

keycloak-db: ## Crée la base PostgreSQL `keycloak` si absente (idempotent)
	@docker exec telecom-postgres psql -U telecom -d telecom_tickets -tAc "SELECT 1 FROM pg_database WHERE datname='keycloak'" | grep -q 1 \
		|| docker exec telecom-postgres psql -U telecom -d telecom_tickets -c "CREATE DATABASE keycloak"
	@echo "Base PostgreSQL 'keycloak' prête."

keycloak-up: ## Démarre Keycloak avec le realm importé (base keycloak créée si besoin)
	$(MAKE) keycloak-db
	$(COMPOSE) up -d keycloak

keycloak-seed: ## Crée 105 comptes dans Keycloak (realm telecom, http://localhost:8081)
	KEYCLOAK_ADMIN=$(KEYCLOAK_ADMIN) KEYCLOAK_ADMIN_PASSWORD=$(KEYCLOAK_ADMIN_PASSWORD) node keycloak/seed-users.mjs

accounts: ## Affiche les comptes de démonstration principaux
	@echo "Comptes de démonstration"
	@echo "  Login local (AUTH_PROVIDER=local) :"
	@echo "    admin@telecom.local / Admin@1234  (ADMINISTRATOR)"
	@echo "    supervisor@telecom.local / Super@1234  (SUPERVISOR)"
	@echo "    agent-cc1@telecom.local / Agent@1234  (CUSTOMER_SERVICE_AGENT)"
	@echo "  SSO Keycloak (AUTH_PROVIDER=keycloak) - http://localhost:8081 :"
	@echo "    admin@telecom.local / Admin@1234  (ADMINISTRATOR)"
	@echo "    supervisor@telecom.local / Super@1234  (SUPERVISOR)"
	@echo "    105 comptes seed : agent.<ROLE>.<1..15>@telecom.local / Telecom@2026!"
	@echo "  Console admin Keycloak : http://localhost:8081/admin - $(KEYCLOAK_ADMIN) / $(KEYCLOAK_ADMIN_PASSWORD)"

publish: ## Publie les images backend et portail sur le registry (REGISTRY/TAG)
	@test -n "$(REGISTRY)" || (echo "Précisez REGISTRY=registry.example.com" && exit 1)
	@docker tag testbackendtelecom-api $(REGISTRY)/telecom-api:$(TAG)
	@docker tag testbackendtelecom-public-frontend $(REGISTRY)/telecom-public-frontend:$(TAG)
	@docker tag testbackendtelecom-frontend $(REGISTRY)/telecom-frontend:$(TAG)
	@docker tag testbackendtelecom-keycloak $(REGISTRY)/telecom-keycloak:$(TAG)
	@docker push $(REGISTRY)/telecom-api:$(TAG)
	@docker push $(REGISTRY)/telecom-public-frontend:$(TAG)
	@docker push $(REGISTRY)/telecom-frontend:$(TAG)
	@docker push $(REGISTRY)/telecom-keycloak:$(TAG)
	@echo "Images publiées : api, public-frontend, frontend, keycloak (tag $(TAG))"

prod-up: ## Démarre la stack production (HTTPS via nginx)
	$(COMPOSE) -f docker-compose.prod.yml up -d

prod-down: ## Arrête la stack production
	$(COMPOSE) -f docker-compose.prod.yml down

prod-build: ## Construit les images production (api, frontend, portail, keycloak)
	$(COMPOSE) -f docker-compose.prod.yml build

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
