# Phase 00 — Cadrage et décisions (révisée après retour utilisateur)

## Statut
- Prévu — première phase, ne dépend de rien.
- Références : `plan.md`, inspection du dépôt le 14/08/2026 (auth, frontends, realm, docs).

## Contexte
La mission mêle trois chantiers (Keycloak, UI, nettoyage) sur trois surfaces (backend, frontend interne, portail public). L'utilisateur a revu le périmètre le 14/08/2026 : **plus d'enrichissement Keycloak sauf observabilité (logs/traces/erreurs)** ; D1/D2/D5/D6 actés ; D3/D4 abandonnés. Les décisions sont donc figées avant implémentation.

## Objectif
Transcrire les décisions actées, verrouiller le périmètre réduit, lister ce qui est explicitement exclu, et ne laisser aucune question bloquante ouverte.

## Réponses utilisateur actées (14/08/2026)
| # | Sujet | Décision |
|---|-------|----------|
| 1 | Périmètre Keycloak | **Réduit** : uniquement voir les logs, tracer les erreurs (événements → `audit_logs` + observabilité) ; protection brute force (D6 OK). Tout le reste (groups/mappers, step-up, passkeys, organizations, brokering, fine-grained) **abandonné**. |
| 2 | D1 — Marque | **OK** : « KAMGOKO ITSM » + `logo.png` racine (recommandation acceptée). |
| 3 | D2 — `refresh_tokens` | **OK suppression** : vérifier TOUS les liens/références avant ; passer en **Keycloak-only** (suppression HS256, `AUTH_PROVIDER`, env JWT locaux). |
| 4 | D3 — Step-up ACR/OTP | **Abandonné**. |
| 5 | D4 — Passkeys/WebAuthn | **Abandonné**. |
| 6 | D5 — Fenêtre avant DROP | **OK** : fenêtre configurable via variable d'environnement (proposé `REFRESH_TOKENS_DROP_GRACE_DAYS`, défaut 14 jours). |
| 7 | D6 — Brute force | **OK** : 5 échecs / 15 min côté Keycloak, alignement documenté avec le Throttler applicatif. |
| 8 | Rapports intermédiaires | Les rapports scout/research/red-team de cette mission sont **supprimés** (demande utilisateur) ; les faits vérifiés sont intégrés dans les phases. |
| 9 | UI | Rendu moderne sobre type Vercel/Next.js, dark mode réel, **aucune mention visible de « Keycloak »**. |
| 10 | Contrats | OpenAPI re-vérifié (115/139 ; 30/33) — ne pas changer le contrat. |

## Décisions restantes
- **Aucune décision bloquante** : D1, D2, D5, D6 actés ; D3/D4 abandonnés.
- Détails d'implémentation à confirmer en début de phase 01 : nom exact de la variable env D5 (proposé `REFRESH_TOKENS_DROP_GRACE_DAYS`), chemin du logo (proposé `logo.png` racine).

## Hors périmètre (explicite)
- Enrichissement Keycloak : groups, attributs, mappers OIDC, step-up ACR, OTP conditionnel, WebAuthn/passkeys, organizations, identity brokering, fine-grained admin permissions.
- Nouveaux endpoints OpenAPI ou changements de contrat.
- Refonte fonctionnelle des pages métier (tickets, dashboard) : uniquement style/tokens.
- Modification des routes internes `/api/auth/keycloak/*` et des noms de variables (texte visible uniquement).

## Critères de validation de la phase 00
- [ ] Décisions utilisateur transcrites ci-dessus avec leur date.
- [ ] Périmètre réduit reflété dans les phases 01, 02, 06 et 07.
- [ ] Aucune implémentation avant validation utilisateur du plan révisé.
- [ ] Le dossier de plan est lisible par une personne tierce sans question.

## Tests
- Validation = relecture du dossier par l'utilisateur (approbation explicite exigée avant la phase 01).

## Fichiers
- **Créer** : `phase-00-cadrage-decisions.md`, `plan.md` (déjà présents dans le dossier).
- **Modifier** : aucun fichier de code.

## Critères de succès
- `plan.md` révisé approuvé par l'utilisateur (Y/N) ; aucune question métier restante.
- Le statut de cette phase passe à « terminée » uniquement après cette validation.
