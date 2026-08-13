# Comptes de Test

## Vue d'ensemble

14 utilisateurs sont créés automatiquement par `pnpm run db:seed`.
7 rôles répartis dans 6 départements.

---

## Administrateur (accès total)

| Email                 | Mot de passe | Rôle          | Département    |
| --------------------- | ------------ | ------------- | -------------- |
| `admin@telecom.local` | `Admin@1234` | ADMINISTRATOR | Administration |

**Capacités** : gestion complète de tous les utilisateurs, tickets, départements, SLA, paramètres système, audit logs. Vue globale (pas de cloisonnement départemental).

---

## Superviseurs

| Email                          | Mot de passe | Rôle       | Département   |
| ------------------------------ | ------------ | ---------- | ------------- |
| `supervisor@telecom.local`     | `Super@1234` | SUPERVISOR | Customer Care |
| `supervisor-noc@telecom.local` | `Super@1234` | SUPERVISOR | NOC           |

**Capacités** : assignation/réassignation de tickets, clôture/réouverture, gestion des utilisateurs de leur département, audit logs. Vue cloisonnée par département.

---

## Agents Customer Care

| Email                     | Mot de passe | Rôle                   | Département   |
| ------------------------- | ------------ | ---------------------- | ------------- |
| `agent-cc1@telecom.local` | `Agent@1234` | CUSTOMER_SERVICE_AGENT | Customer Care |
| `agent-cc2@telecom.local` | `Agent@1234` | CUSTOMER_SERVICE_AGENT | Customer Care |

---

## Ingénieurs NOC

| Email                | Mot de passe | Rôle         | Département |
| -------------------- | ------------ | ------------ | ----------- |
| `noc1@telecom.local` | `Agent@1234` | NOC_ENGINEER | NOC         |
| `noc2@telecom.local` | `Agent@1234` | NOC_ENGINEER | NOC         |

---

## Agents Facturation

| Email                    | Mot de passe | Rôle          | Département |
| ------------------------ | ------------ | ------------- | ----------- |
| `billing1@telecom.local` | `Agent@1234` | BILLING_AGENT | Billing     |
| `billing2@telecom.local` | `Agent@1234` | BILLING_AGENT | Billing     |

---

## Support Technique

| Email                 | Mot de passe | Rôle                       | Département       |
| --------------------- | ------------ | -------------------------- | ----------------- |
| `tech1@telecom.local` | `Agent@1234` | TECHNICAL_SUPPORT_ENGINEER | Technical Support |
| `tech2@telecom.local` | `Agent@1234` | TECHNICAL_SUPPORT_ENGINEER | Technical Support |
| `agent@telecom.local` | `Agent@1234` | TECHNICAL_SUPPORT_ENGINEER | Technical Support |

---

## Techniciens Terrain

| Email                  | Mot de passe | Rôle             | Département      |
| ---------------------- | ------------ | ---------------- | ---------------- |
| `field1@telecom.local` | `Agent@1234` | FIELD_TECHNICIAN | Field Operations |
| `field2@telecom.local` | `Agent@1234` | FIELD_TECHNICIAN | Field Operations |

> **Note** : Les `FIELD_TECHNICIAN` n'ont pas accès aux notes internes ni aux audit logs.

---

## Connexion rapide via cURL

```bash
# Les routes locales /api/v1/auth/login ont été supprimées : l'authentification
# passe par Keycloak SSO. Se connecter sur http://localhost:3007 avec un compte
# du realm telecom, puis réutiliser le jeton Keycloak (RS256) pour l'API.
```

## Utiliser le token

```bash
# Récupérer le jeton depuis la session SSO (jeton d'accès Keycloak)
TOKEN="eyJhbGciOiJI..."

# Lister les tickets
curl http://localhost:3000/api/v1/tickets \
  -H "Authorization: Bearer $TOKEN"

# Créer un ticket
curl -X POST http://localhost:3000/api/v1/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Panne réseau secteur Nord",
    "description": "Coupure complète du réseau fibre dans le secteur Nord depuis 14h.",
    "categoryId": "<id-categorie>",
    "priority": "HIGH",
    "severity": "S2",
    "customerName": "Jean Dupont",
    "customerAccountNumber": "ACC-123456"
  }'
```

---

## Outils de monitoring

| URL                                  | Service        | Identifiants        |
| ------------------------------------ | -------------- | ------------------- |
| `http://localhost:3000/api/v1`       | API REST       | Bearer token Keycloak |
| `http://localhost:3000/api/docs`     | Swagger UI     | Aucun               |
| `http://localhost:3000/admin/queues` | BullBoard      | `admin`/`bullboard` |
| `http://localhost:8025`              | Mailpit (mail) | Aucun               |
| `http://localhost:3001`              | Grafana        | `admin`/`admin`     |
| `http://localhost:9090`              | Prometheus     | Aucun               |

---

## SSO Keycloak (fournisseur unique)

Keycloak tourne sur **http://localhost:8081** (8080 est utilisé par PhotoVault). Le realm `telecom` est importé au premier démarrage ; `make keycloak-seed` crée les 105 comptes métier.

| Usage                     | Identifiant                                         | Mot de passe    |
| ------------------------- | --------------------------------------------------- | --------------- |
| Login SSO — Administrateur | `admin@telecom.local`                               | `Admin@1234`    |
| Login SSO — Superviseur    | `supervisor@telecom.local`                          | `Super@1234`    |
| 105 agents seed            | `agent.<ROLE>.<1..15>@telecom.local` (7 rôles × 15) | `Telecom@2026!` |
| Console admin Keycloak     | `admin`                                             | `Admin@1234`    |

Les comptes SSO sont liés aux profils métier (département, rôle) par email vérifié (`users.keycloakSubjectId`). La page de login est thématisée (Keycloakify v11) : `http://localhost:8081/realms/telecom/protocol/openid-connect/auth`.
