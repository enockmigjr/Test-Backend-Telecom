# Phase 00 — Cadrage et décisions

## Objectif

Figer le périmètre, les choix utilisateur et les questions restantes avant implémentation, afin qu'un autre intervenant puisse prendre la main sans re-questionner l'architecture.

## Réponses utilisateur actées (2026-08-12)

| # | Sujet | Décision |
|---|-------|----------|
| 1 | Portée SSO | Frontend interne uniquement (portail public et widget conservent leur BFF). |
| 1 | Login local | Supprimé après bascule ; pas de fallback. |
| 1 | Profil | Le système ne garde que le profil métier (département, disponibilité, absence) ; identité/roles dans Keycloak. |
| 1 | Hébergement | Keycloak en conteneur docker-compose (à valider avec la recherche de version). |
| 1 | Thème | Keycloakify aux couleurs réelles de l'app — **couleur à corriger** (voir ci-dessous). |
| 1 | Comptes existants | Supprimés ; repartir de zéro avec un **seed complet** (Keycloak + métier). |
| 2 | Évaluation | Toutes les métriques possibles + **page dédiée**. |
| 3 | Pause | Pause **des agents** (pas pause SLA) : UI manquante à créer + cohérence jobs. |
| 4 | Dashboards | Dashboard **agent** + dashboard **supervision/admin**, interne et support public **séparés**. |
| 5 | Routes publiques | Audit fait ; compléter « tout et plus » (réfléchir ensemble). |
| 6 | Satisfaction | Note de satisfaction à implémenter si faisable simplement. |
| 7 | Config admin | « Toutes les possibilités » existantes à exposer. |
| 8 | Réponse au demandeur | Investigation + recommandation à présenter (options ci-dessous). |

## Couleur réelle de l'app (thème Keycloakify)

Les tokens CSS du frontend interne ([globals.css](../../frontend/src/app/globals.css)) définissent :

- `--primary: oklch(0.218 0.008 223.9)` → bleu nuit très sombre (≈ #172033) ;
- `--color-brand-600: #1d4ed8` (bleu), `--color-brand-500: #2563eb` ;
- accent navigation par défaut `#1d4ed8`, variantes slate `#334155` et teal `#0f766e` ;
- `--success: #0f766e` (teal), `--danger: #b42318`.

**Question ouverte** : le thème Keycloakify doit-il utiliser (a) bleu nuit `#172033` + bleu `#1d4ed8` (recommandé, cohérent avec le topbar/sidebar), ou (b) uniquement le bleu `#1d4ed8` ?

## Décisions restantes (questions à trancher)

1. **Keycloak** : version cible (26.x recommandée), domaine (localhost vs prod), et détail du seed (quels utilisateurs/rôles de démo ?).
2. **Pause agents** : valider le design proposé en phase 03 (pause courte auto-déclenchée, absence planifiée, absence prolongée avec réaffectation après X jours configurable).
3. **Réponse au demandeur** : choisir entre les 3 options de la phase 05 (recommandée : action explicite « Répondre au demandeur »).
4. **Satisfaction** : valider la note 1–5 + commentaire à la clôture des tickets publics.
5. **Score d'évaluation** : score automatique pondéré souhaité (oui/non) et pondération.
6. **Config admin** : prioriser les réglages supplémentaires (business hours, notifications, quotas, bot, seuils d'escalade, origines).
7. **Déploiement** : cible production (serveur unique, HTTPS, backup) ou local uniquement pour ce cycle.

## Critères de validation de la phase 00

- Toutes les réponses utilisateur transcrites dans ce fichier.
- Aucune implémentation de phase 07 avant réponse sur le seed Keycloak et la couleur.
- Le plan.md et les phases sont lisibles par une personne tierce (workflow + critères par phase).

## Tests

- Aucun test automatisé pour cette phase ; validation = relecture du dossier de plan par l'utilisateur.
