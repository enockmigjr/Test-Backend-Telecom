# Plan — SSO Keycloak, évaluation des agents, pause/absence, dashboards, support public et DevOps

## Statut

- État : cadrage validé (11 points + 5 arbitrages utilisateur : couleur Keycloakify #172033/#1d4ed8, option B réponse au demandeur, pause agents 3 niveaux avec absence prolongée admin/superviseur, satisfaction, score 40/30/20/10).
- **Livrées et poussées** : correctifs bloquants (commentaires 500, modals, responsivité), stats support public, performance agents (endpoint + page + score), Mon activité (dashboard agent), onglets Interne/Support public, pause/reprise/absence agents (backend + UI), réponse explicite au demandeur (option B), seuil absence prolongée configurable, fix processeur SLA (relances email vérifiées live), Makefile de base, pondérations de charge admin.
- **En cours** : phase 5b (satisfaction). **Restantes** : 6 (déploiement prod), 7 (Keycloak SSO + Keycloakify), 8 (config admin étendue).
- Décisions utilisateur actées : SSO frontend interne uniquement ; suppression du login local (pas de fallback) ; Keycloak unique source d'identité, le système ne garde que le profil métier ; Keycloak en conteneur docker-compose ; thème Keycloakify aux couleurs réelles de l'app ; comptes existants supprimés et repartis de zéro avec un seed complet.
- Design source : `contexte/phase-1-system-design.md`, `contexte/phase-3-api-design-and-implementation-strategy.md`, `plans/260730-1350-trouble-ticket-public-multicanal/plan.md`, `docs/architecture/public-support-contracts.md`.
- Dépendances : `keycloak` (conteneur), `keycloakify` (thème), adaptateur d'auth NestJS (clé publique/JWKS), seed Keycloak (realm-export.json) + seed profil métier.

## Objectif

Livrer, dans l'ordre du chemin critique : (0) cadrage figé, (1) correctifs livrés vérifiés, (2) évaluation des agents avec page dédiée et métriques complètes, (3) gestion réelle de la pause/absence/absence prolongée des agents dans l'app et les jobs, (4) deux dashboards (agent + supervision/admin, interne et support public séparés), (5) intégration complète des routes support public + meilleure réponse au demandeur + note de satisfaction, (6) déploiement facile (Makefile, conteneurs, env, données, DB), (7) Keycloak SSO + Keycloakify (identité externalisée, logique métier conservée), (8) config admin étendue.

## Décisions d'exécution (cadrage validé)

1. SSO : frontend interne uniquement ; le portail public et le widget conservent leur flux BFF actuel (non concernés par Keycloak).
2. Identité : Keycloak = source de vérité (comptes, mots de passe, rôles). Le backend ne garde que le profil métier (département, disponibilité, absence) lié par `keycloakSubjectId`.
3. Suppression du login local après bascule ; seed Keycloak (realm, clients, rôles, utilisateurs) + seed métier (départements, profils, catégories, SLA) pour repartir sans tout refaire.
4. Thème Keycloakify : couleurs réelles de l'app (tokens CSS : primary oklch(0.218 0.008 223.9), brand-600 #1d4ed8, teal #0f766e ; à confirmer).
5. Pause des agents = fonctionnalité utilisateur complète (auto + manuelle + absence planifiée), pas de pause SLA dédiée (l'existant statut PENDING suffit).
6. Deux dashboards : `Mon activité` (agent) et `Tableau de bord` (supervision/admin) avec blocs interne et support public séparés.
7. Réponse au demandeur externe : choix d'une option parmi trois proposées en phase 0 (recommandée : action explicite).
8. Satisfaction : note 1–5 + commentaire, demandée à la clôture des tickets publics.
9. Rôles 7 existants conservés dans Keycloak (mappage claims → rôle interne).

## Séquence

1. [Phase 00 — Cadrage et décisions](./phase-00-cadrage-decisions.md)
2. [Phase 01 — Correctifs déjà livrés](./phase-01-corrections-livrees.md)
3. [Phase 02 — Évaluation des agents](./phase-02-evaluation-agents.md)
4. [Phase 03 — Pause / absence / absence prolongée](./phase-03-pause-absence-agents.md)
5. [Phase 04 — Dashboards agent + supervision](./phase-04-dashboards.md)
6. [Phase 05 — Support public : réponse au demandeur, satisfaction, stats](./phase-05-support-public.md)
7. [Phase 06 — DevOps : déploiement facile](./phase-06-devops-deploiement.md)
8. [Phase 07 — Keycloak SSO + Keycloakify](./phase-07-keycloak-sso-keycloakify.md)
9. [Phase 08 — Config admin étendue](./phase-08-config-admin-etendue.md)

## Chemin critique

`Phase 0 → 1 (livrée) → 2/3/4 (parallélisables) → 5 → 6 → 7`

La phase 7 (Keycloak) est la plus risquée : elle conditionne la sécurité de l'identité et nécessite la validation du realm avant suppression du login local. Les phases 2, 3 et 4 sont indépendantes entre elles et peuvent être menées en parallèle (sous-agents) tant qu'elles ne touchent pas les mêmes fichiers.

## Gates absolues

- Aucune suppression du login local tant que le parcours Keycloak complet (login → session BFF → rôles → seed métier) n'est pas validé sur navigateur.
- Aucun accès API sans résolution du profil métier à partir du sujet Keycloak (404/403 clair sinon).
- Aucun secret Keycloak (client secret, clé maître) dans Git ; `.env` uniquement.
- Aucun ticket réaffecté automatiquement pendant une absence sans seuil documenté et historique système.
- Aucune réponse publique au demandeur sans confirmation du canal (email) et de la politique de confidentialité.
- Suites de tests complètes des 3 dépôts au vert avant chaque jalon.

## Preuves de clôture

- Realm Keycloak importé depuis un seed versionné, login SSO fonctionnel, logout SSO, rotation des rôles via claims.
- Profils métier recréés par seed (mêmes utilisateurs/départements que l'existant) et liés aux sujets Keycloak.
- Page « Performance des agents » avec les métriques validées ; dashboard agent et dashboard supervision fonctionnels.
- Pause/absence modifiables dans l'app (agent + admin), exclues de l'auto-assignation, réaffectation documentée.
- Réponse au demandeur + note de satisfaction livrées et testées (parcours public E2E).
- Makefile + scripts de déploiement testés sur base propre (migrations + seed + conteneurs).
