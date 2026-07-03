# Catalogue Complet des Routes API

**Base URL**: `http://localhost:${API_PORT:-3000}/${API_PREFIX:-api/v1}`
**Documentation Swagger**: `http://localhost:${API_PORT:-3000}/api/docs`

---

## Authentification (`/auth`)

| Méthode | Route                   | Auth   | Rôles | Description                                                                |
| ------- | ----------------------- | ------ | ----- | -------------------------------------------------------------------------- |
| `POST`  | `/auth/login`           | Public | -     | Connexion utilisateur (rate limit: 10/heure/IP)                            |
| `POST`  | `/auth/refresh`         | Public | -     | Rafraîchir la paire de tokens (rotation)                                   |
| `POST`  | `/auth/logout`          | Bearer | Tous  | Déconnexion — révoque le refresh token fourni + blacklist JTI access token |
| `POST`  | `/auth/logout-all`      | Bearer | Tous  | Déconnexion de toutes les sessions actives                                 |
| `GET`   | `/auth/me`              | Bearer | Tous  | Profil de l'utilisateur connecté                                           |
| `PUT`   | `/auth/change-password` | Bearer | Tous  | Changer le mot de passe                                                    |

---

## Départements (`/departments`)

| Méthode  | Route              | Auth   | Rôles         | Description                                             |
| -------- | ------------------ | ------ | ------------- | ------------------------------------------------------- |
| `GET`    | `/departments`     | Bearer | Tous          | Liste des départements (utilisateurs authentifiés)      |
| `GET`    | `/departments/:id` | Bearer | Tous          | Détails d'un département                                |
| `POST`   | `/departments`     | Bearer | ADMINISTRATOR | Créer un département                                    |
| `PATCH`  | `/departments/:id` | Bearer | ADMINISTRATOR | Modifier un département                                 |
| `DELETE` | `/departments/:id` | Bearer | ADMINISTRATOR | Supprimer un département (bloqué si users/tickets liés) |

---

## Utilisateurs (`/users`)

| Méthode | Route                   | Auth   | Rôles                                  | Description                                           |
| ------- | ----------------------- | ------ | -------------------------------------- | ----------------------------------------------------- |
| `GET`   | `/users`                | Bearer | ADMINISTRATOR, SUPERVISOR              | Liste paginée, triable, filtrable                     |
| `GET`   | `/users/me`             | Bearer | Tous                                   | Profil détaillé de l'utilisateur connecté             |
| `GET`   | `/users/:id`            | Bearer | ADMINISTRATOR, SUPERVISOR, ou soi-même | Détails d'un utilisateur                              |
| `POST`  | `/users`                | Bearer | ADMINISTRATOR                          | Créer un utilisateur (mot de passe temporaire généré) |
| `PATCH` | `/users/:id`            | Bearer | ADMINISTRATOR, SUPERVISOR              | Modifier un utilisateur                               |
| `PATCH` | `/users/:id/deactivate` | Bearer | ADMINISTRATOR                          | Désactiver un compte                                  |
| `PATCH` | `/users/:id/activate`   | Bearer | ADMINISTRATOR                          | Réactiver un compte                                   |

---

## Tickets (`/tickets`)

| Méthode  | Route                              | Auth   | Rôles                                        | Description                                                   |
| -------- | ---------------------------------- | ------ | -------------------------------------------- | ------------------------------------------------------------- |
| `POST`   | `/tickets`                         | Bearer | Tous                                         | Créer un ticket d'incident                                    |
| `GET`    | `/tickets`                         | Bearer | Tous                                         | Rechercher des tickets (filtres combinés, pagination)         |
| `GET`    | `/tickets/:id`                     | Bearer | Tous (selon visibilité)                      | Détails complets d'un ticket                                  |
| `PATCH`  | `/tickets/:id`                     | Bearer | Ownership-based (créateur/assigné/SUP/ADMIN) | Mettre à jour un ticket (champs selon ownership)              |
| `POST`   | `/tickets/:id/assign`              | Bearer | Agent (auto-assign NEW), SUPERVISOR, ADMIN   | Assigner un ticket à un agent                                 |
| `POST`   | `/tickets/:id/reassign`            | Bearer | Assigné actuel, SUPERVISOR, ADMIN            | Réassigner un ticket à un autre agent                         |
| `POST`   | `/tickets/:id/escalate`            | Bearer | Assigné (hiérarchique), SUPERVISOR, ADMIN    | Escalader un ticket (changer agent + département)             |
| `POST`   | `/tickets/:id/start`               | Bearer | Assigné, SUPERVISOR, ADMIN                   | Commencer le traitement (ASSIGNED → IN_PROGRESS)              |
| `POST`   | `/tickets/:id/resolve`             | Bearer | Assigné, SUPERVISOR, ADMIN                   | Marquer comme résolu (IN_PROGRESS → RESOLVED)                 |
| `POST`   | `/tickets/:id/close`               | Bearer | Assigné, SUPERVISOR, ADMIN                   | Clôturer un ticket résolu (RESOLVED → CLOSED)                 |
| `POST`   | `/tickets/:id/reopen`              | Bearer | Créateur CS Agent, SUPERVISOR, ADMIN         | Réouvrir un ticket (≤ 30 jours, raison obligatoire ≥ 10 car.) |
| `POST`   | `/tickets/:id/pending-customer`    | Bearer | Assigné, SUPERVISOR, ADMIN                   | Mettre en attente client (IN_PROGRESS → PENDING_CUSTOMER)     |
| `POST`   | `/tickets/:id/pending-third-party` | Bearer | Assigné, SUPERVISOR, ADMIN                   | Mettre en attente tiers (IN_PROGRESS → PENDING_THIRD_PARTY)   |
| `GET`    | `/tickets/:id/history`             | Bearer | Tous (selon visibilité)                      | Historique complet du ticket                                  |
| `DELETE` | `/tickets/:id`                     | Bearer | ADMINISTRATOR                                | Suppression logique (soft delete)                             |

**Filtres de recherche** (query params sur `GET /tickets`):

- `status`, `priority`, `severity`, `category`
- `assignedTo`, `assignedTeam`, `departmentId`
- `search` (texte: titre, description, numéro ticket)
- `from`, `to` (plage de dates ISO 8601)
- `page`, `limit`, `sort`, `order`

---

## Commentaires Publics (`/comments`)

| Méthode  | Route                         | Auth   | Rôles                     | Description                       |
| -------- | ----------------------------- | ------ | ------------------------- | --------------------------------- |
| `GET`    | `/tickets/:ticketId/comments` | Bearer | Tous (visibilité ticket)  | Commentaires d'un ticket (paginé) |
| `POST`   | `/tickets/:ticketId/comments` | Bearer | Tous                      | Ajouter un commentaire public     |
| `PATCH`  | `/comments/:id`               | Bearer | Auteur, SUPERVISOR, ADMIN | Modifier un commentaire           |
| `DELETE` | `/comments/:id`               | Bearer | Auteur, SUPERVISOR, ADMIN | Supprimer un commentaire          |

---

## Notes Internes (`/internal-notes`)

| Méthode  | Route                               | Auth   | Rôles                      | Description                |
| -------- | ----------------------------------- | ------ | -------------------------- | -------------------------- |
| `GET`    | `/tickets/:ticketId/internal-notes` | Bearer | Tous sauf FIELD_TECHNICIAN | Notes internes d'un ticket |
| `POST`   | `/tickets/:ticketId/internal-notes` | Bearer | Tous sauf FIELD_TECHNICIAN | Ajouter une note interne   |
| `PATCH`  | `/internal-notes/:id`               | Bearer | Auteur, SUPERVISOR, ADMIN  | Modifier une note          |
| `DELETE` | `/internal-notes/:id`               | Bearer | Auteur, SUPERVISOR, ADMIN  | Supprimer une note         |

---

## Pièces Jointes (`/attachments`)

| Méthode  | Route                       | Auth   | Rôles                       | Description                               |
| -------- | --------------------------- | ------ | --------------------------- | ----------------------------------------- |
| `POST`   | `/attachments`              | Bearer | Tous                        | Uploader un fichier (multipart/form-data) |
| `GET`    | `/attachments/:id/download` | Bearer | Tous (visibilité)           | Télécharger un fichier                    |
| `DELETE` | `/attachments/:id`          | Bearer | Uploader, SUPERVISOR, ADMIN | Supprimer une pièce jointe                |

---

## Notifications (`/notifications`)

| Méthode | Route                     | Auth   | Rôles        | Description                             |
| ------- | ------------------------- | ------ | ------------ | --------------------------------------- |
| `GET`   | `/notifications`          | Bearer | Tous         | Notifications de l'utilisateur (paginé) |
| `GET`   | `/notifications/unread`   | Bearer | Tous         | Notifications non lues                  |
| `PATCH` | `/notifications/:id/read` | Bearer | Propriétaire | Marquer comme lue                       |
| `PATCH` | `/notifications/read-all` | Bearer | Tous         | Tout marquer comme lu                   |

---

## Politiques SLA (`/sla-policies`)

| Méthode | Route               | Auth   | Rôles         | Description                |
| ------- | ------------------- | ------ | ------------- | -------------------------- |
| `GET`   | `/sla-policies`     | Bearer | Tous          | Liste des politiques SLA   |
| `GET`   | `/sla-policies/:id` | Bearer | Tous          | Détail d'une politique SLA |
| `POST`  | `/sla-policies`     | Bearer | ADMINISTRATOR | Créer une politique SLA    |
| `PATCH` | `/sla-policies/:id` | Bearer | ADMINISTRATOR | Modifier une politique SLA |

---

## Dashboard (`/dashboard`) — 7 endpoints

| Méthode | Route                            | Auth   | Rôles             | Description                                                                              |
| ------- | -------------------------------- | ------ | ----------------- | ---------------------------------------------------------------------------------------- |
| `GET`   | `/dashboard/overview`            | Bearer | SUPERVISOR, ADMIN | KPIs globaux (params: from, to)                                                          |
| `GET`   | `/dashboard/tickets-by-status`   | Bearer | SUPERVISOR, ADMIN | Tickets par statut + âge moyen (params: from, to, departmentId)                          |
| `GET`   | `/dashboard/tickets-by-priority` | Bearer | SUPERVISOR, ADMIN | Tickets par priorité + breaches SLA (params: from, to, status)                           |
| `GET`   | `/dashboard/departments`         | Bearer | SUPERVISOR, ADMIN | Performance par département (params: from, to)                                           |
| `GET`   | `/dashboard/sla-compliance`      | Bearer | SUPERVISOR, ADMIN | Conformité SLA + tendance (params: from, to, departmentId, priority, category)           |
| `GET`   | `/dashboard/workload`            | Bearer | SUPERVISOR, ADMIN | Charge des agents + tickets non assignés (params: departmentId)                          |
| `GET`   | `/dashboard/resolution-time`     | Bearer | SUPERVISOR, ADMIN | Temps de résolution moyen/médian/p90 (params: from, to, groupBy, departmentId, priority) |

---

## Journaux d'Audit (`/audit-logs`)

| Méthode | Route             | Auth   | Rôles             | Description                      |
| ------- | ----------------- | ------ | ----------------- | -------------------------------- |
| `GET`   | `/audit-logs`     | Bearer | SUPERVISOR, ADMIN | Rechercher dans les logs d'audit |
| `GET`   | `/audit-logs/:id` | Bearer | SUPERVISOR, ADMIN | Détail d'un événement d'audit    |

**Filtres** (query params):

- `userId`, `action`, `entityType`, `from`, `to`, `page`, `limit`

---

## Rapports (`/reports`)

| Méthode | Route                          | Auth   | Rôles             | Description                                                                                          |
| ------- | ------------------------------ | ------ | ----------------- | ---------------------------------------------------------------------------------------------------- |
| `GET`   | `/reports/ticket/:id`          | Bearer | SUPERVISOR, ADMIN | Détails du rapport d'un ticket (synchrone — données JSON)                                            |
| `POST`  | `/reports/ticket/:id/generate` | Bearer | SUPERVISOR, ADMIN | Générer un rapport d'incident PDF (async, répond 202 avec `reportId`, envoie email avec lien de téléchargement) |
| `GET`   | `/reports/sla`                 | Bearer | SUPERVISOR, ADMIN | Rapport SLA synchrone (params: from, to — données JSON)                                              |
| `POST`  | `/reports/sla/generate`        | Bearer | SUPERVISOR, ADMIN | Générer un rapport SLA PDF (async, répond 202 avec `reportId`, envoie email avec lien de téléchargement)     |
| `POST`  | `/reports/weekly/generate`     | Bearer | SUPERVISOR, ADMIN | Générer un rapport hebdomadaire PDF (async, répond 202 avec `reportId`, envoie email avec lien de téléchargement) |
| `GET`   | `/reports`                     | Bearer | ADMINISTRATOR     | Lister l'ensemble des rapports générés en asynchrone (paginé)                                        |
| `GET`   | `/reports/:id/download`        | Bearer | SUPERVISOR, ADMIN | Télécharger le fichier PDF physique d'un rapport généré (si prêt, restreint à l'admin/demandeur)     |

---

## Racine & Santé

| Méthode | Route           | Auth   | Description                                                  |
| ------- | --------------- | ------ | ------------------------------------------------------------ |
| `GET`   | `/`             | Public | Informations sur l'API (nom, version, docs, health, metrics) |
| `GET`   | `/health`       | Public | Liveness check (uptime, mémoire)                             |
| `GET`   | `/health/ready` | Public | Readiness check (PostgreSQL + Redis ping)                    |
| `GET`   | `/metrics`      | Public | Métriques Prometheus au format OpenMetrics                   |

---

## Supervision BullMQ (`/admin/queues`)

| Méthode | Route           | Auth                             | Description                                     |
| ------- | --------------- | -------------------------------- | ----------------------------------------------- |
| `GET`   | `/admin/queues` | Basic Auth (prod) / Public (dev) | Interface BullBoard de supervision des 5 queues |

En production, protéger avec `BULLBOARD_USER` et `BULLBOARD_PASSWORD` dans `.env`.

---

**Total: 55 routes sur 14 contrôleurs (dont 1 route admin BullBoard)**

---
