# Comptes de Test & Démo (PostgreSQL & Keycloak SSO)

> Ce document liste l'ensemble des comptes de démonstration et de test provisionnés dans le système.
> L'authentification passe **exclusivement** par Keycloak SSO (RS256 / JWKS) sur port **8081**.
> Les profils métier (département, droits applicatifs) sont stockés dans la base PostgreSQL `telecom_tickets`.

---

## 1. Vue d'ensemble des jeux de données

| Composant | Nombre de comptes | Source de données | Script de peuplement |
| --- | --- | --- | --- |
| **Comptes Métier PostgreSQL** | 14 utilisateurs | Base `telecom_tickets` (table `users`) | `pnpm run db:seed` |
| **Comptes SSO Keycloak** | 105 utilisateurs (7 rôles × 15) | Realm Keycloak `telecom` | `node keycloak/seed-users.mjs` |
| **Console Admin Keycloak** | 1 administrateur master | Realm `master` Keycloak | `KEYCLOAK_ADMIN` env var |

---

## 2. Comptes Métier PostgreSQL (14 Utilisateurs de Démo)

Tous ces comptes sont pré-créés par `pnpm run db:seed`.

### 2.1. Administrateur Système (1 compte)

| Email | Mot de passe | Rôle Métier | Département | Droits & Portée |
| --- | --- | --- | --- | --- |
| `admin@telecom.local` | `Admin@1234` | `ADMINISTRATOR` | Administration | Accès global non cloisonné, gestion des utilisateurs, SLA, paramètres système, audit, rapports PDF |

### 2.2. Superviseurs (2 comptes)

| Email | Mot de passe | Rôle Métier | Département | Droits & Portée |
| --- | --- | --- | --- | --- |
| `supervisor@telecom.local` | `Super@1234` | `SUPERVISOR` | Customer Care | Assignation, clôture/réouverture, notes internes, audit logs. Portée : Customer Care |
| `supervisor-noc@telecom.local` | `Super@1234` | `SUPERVISOR` | NOC | Assignation, escalade réseau, surveillance SLA 24/7. Portée : NOC |

### 2.3. Agents Customer Care (2 comptes)

| Email | Mot de passe | Rôle Métier | Département | Droits & Portée |
| --- | --- | --- | --- | --- |
| `agent-cc1@telecom.local` | `Agent@1234` | `CUSTOMER_SERVICE_AGENT` | Customer Care | Création, réponse client, qualification initiale. Portée : Customer Care |
| `agent-cc2@telecom.local` | `Agent@1234` | `CUSTOMER_SERVICE_AGENT` | Customer Care | Création, réponse client, suivi demandes. Portée : Customer Care |

### 2.4. Ingénieurs NOC (2 comptes)

| Email | Mot de passe | Rôle Métier | Département | Droits & Portée |
| --- | --- | --- | --- | --- |
| `noc1@telecom.local` | `Agent@1234` | `NOC_ENGINEER` | NOC | Incidents réseau S1/S2, supervision infrastructure. Portée : NOC |
| `noc2@telecom.local` | `Agent@1234` | `NOC_ENGINEER` | NOC | Diagnostic fibre/radio, gestion pannes majeures. Portée : NOC |

### 2.5. Agents Facturation (2 comptes)

| Email | Mot de passe | Rôle Métier | Département | Droits & Portée |
| --- | --- | --- | --- | --- |
| `billing1@telecom.local` | `Agent@1234` | `BILLING_AGENT` | Billing | Litiges financiers, ajustements de factures. Portée : Billing |
| `billing2@telecom.local` | `Agent@1234` | `BILLING_AGENT` | Billing | Demandes de résiliation, remboursements. Portée : Billing |

### 2.6. Support Technique Approfondi (3 comptes)

| Email | Mot de passe | Rôle Métier | Département | Droits & Portée |
| --- | --- | --- | --- | --- |
| `tech1@telecom.local` | `Agent@1234` | `TECHNICAL_SUPPORT_ENGINEER` | Technical Support | Support niveau 2/3, diagnostics ADSL/VoIP. Portée : Technical Support |
| `tech2@telecom.local` | `Agent@1234` | `TECHNICAL_SUPPORT_ENGINEER` | Technical Support | Résolution dysfonctionnements logiciels/firmware. Portée : Technical Support |
| `agent@telecom.local` | `Agent@1234` | `TECHNICAL_SUPPORT_ENGINEER` | Technical Support | Compte générique de test d'intégration |

### 2.7. Techniciens Terrain (2 comptes)

| Email | Mot de passe | Rôle Métier | Département | Restrictions applicatives |
| --- | --- | --- | --- | --- |
| `field1@telecom.local` | `Agent@1234` | `FIELD_TECHNICIAN` | Field Operations | Remplacement matériel, interventions physiques. **Pas d'accès aux notes internes ni aux logs d'audit** |
| `field2@telecom.local` | `Agent@1234` | `FIELD_TECHNICIAN` | Field Operations | Reparations d'infrastructures physiques. **Pas d'accès aux notes internes ni aux logs d'audit** |

---

## 3. Comptes SSO Keycloak (105 Comptes Seed par Rôle)

Le script `node keycloak/seed-users.mjs` (ou `make keycloak-seed`) génère **105 comptes SSO** dans le realm Keycloak `telecom` :

- **Pattern des identifiants** : `agent.<role_lowercase>.<index>@telecom.local`
- **Exemple** : `agent.noc_engineer.1@telecom.local` jusqu'à `agent.noc_engineer.15@telecom.local`
- **Mot de passe par défaut** : `Telecom@2026!`
- **Rôles Realm attribués** : Le rôle exact dans Keycloak (`ADMINISTRATOR`, `SUPERVISOR`, etc.)
- **Rôles Client Account** : `view-profile` et `manage-account` attribués automatiquement pour autoriser l'accès à la console de compte.

---

## 4. Utilisation de l'API avec Jeton Keycloak (Exemples cURL)

Toutes les requêtes API nécessitent un jeton d'accès Bearer signé en RS256 par Keycloak.

### 4.1. Récupération d'un jeton d'accès (Direct Access Grant pour scripts dev)

```bash
curl -X POST http://localhost:8081/realms/telecom/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=telecom-frontend" \
  -d "username=admin@telecom.local" \
  -d "password=Admin@1234"
```

### 4.2. Appel API authentifié (Profil /me)

```bash
TOKEN="<access_token_keycloak>"

curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### 4.3. Création d'un ticket via l'API

```bash
curl -X POST http://localhost:3000/api/v1/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "title": "Panne fibre optique — Client Entreprise ZI",
    "description": "Perte totale du lien principal 1 Gbps.",
    "categoryId": "<category-id-uuid>",
    "priority": "CRITICAL",
    "severity": "S1",
    "customerName": "ZI Est Industries",
    "customerAccountNumber": "ACC-001-ZIE"
  }'
```

---

## 5. Matrice des Services et Identifiants de Monitoring

| Service | URL | Authentification / Identifiants |
| --- | --- | --- |
| **API REST Backend** | `http://localhost:3000/api/v1` | Bearer Jeton RS256 Keycloak |
| **Documentation Swagger** | `http://localhost:3000/api/docs` | Accès libre |
| **Interface Frontend Interne** | `http://localhost:3007` | Connexion SSO Keycloak |
| **Portail Support Public** | `http://localhost:3005` | Session Publique / OTP / Assertion WP |
| **Console Admin Keycloak** | `http://localhost:8081/admin` | Nom: `admin` / Mdp: `Admin@1234` |
| **Console Compte Keycloak** | `http://localhost:8081/realms/telecom/account/` | Compte utilisateur SSO connecté |
| **Interface BullBoard** | `http://localhost:3000/admin/queues` | Login: `admin` / Mdp: `bullboard` |
| **Interface Mailpit (SMTP)** | `http://localhost:8025` | Accès libre |
| **Tableaux de bord Grafana** | `http://localhost:3001` | Login: `admin` / Mdp: `admin` |
| **Collecteur Prometheus** | `http://localhost:9090` | Accès libre |
| **Monitoring Uptime Kuma** | `http://localhost:3002` | Premier démarrage : création compte admin |
