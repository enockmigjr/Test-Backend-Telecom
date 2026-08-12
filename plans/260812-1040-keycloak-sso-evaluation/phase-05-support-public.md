# Phase 05 — Support public : réponse au demandeur, satisfaction, stats

## Objectif

Finaliser l'intégration des routes support public (audit fait : 30 routes couvertes), choisir la meilleure façon de répondre à un demandeur externe depuis l'interne, et livrer une note de satisfaction.

## Réponse au demandeur externe — options (à trancher)

Contexte : aujourd'hui, un commentaire interne posé sur un ticket public est **aussi** persisté comme réponse publique (`PublicReplyPersistenceService.persist` → `support_messages` OUTBOUND + outbox email), en une seule action.

- **Option A (actuelle)** : commentaire interne ⇒ réponse publique automatique. Simple, mais mélange les intentions (note interne visible par le demandeur si erreur).
- **Option B (recommandée)** : action explicite **« Répondre au demandeur »** dans les actions du ticket : ouvre un formulaire dédié, crée la réponse publique (timeline + email) ET une note interne de synthèse optionnelle. Le commentaire classique reste interne uniquement.
- **Option C** : deux champs distincts (note interne / réponse publique) dans le même formulaire. Plus riche mais plus de surface UI.

## Workflow (option B)

1. Backend : route `POST /tickets/:id/public-reply` (INTERNAL) qui crée `ticket_comments` (actorType INTERNAL, `supportIntegrationId`) + `support_messages` OUTBOUND + outbox email au demandeur ; garde `publicReplies.persist` pour compat ; verrouillage si conversation absente (409 explicite).
2. Retirer l'auto-persistance des commentaires classiques sur tickets publics (changement de comportement : le commentaire redevient interne) — à confirmer.
3. Frontend : action « Répondre au demandeur » dans `ticket-actions.tsx` (formulaire + aperçu), affichage des réponses publiques dans la timeline (déjà en place).
4. Email : template dédié « réponse support » au demandeur (lien de suivi signé).

## Note de satisfaction

1. À la clôture d'un ticket public, envoyer au demandeur un email avec lien signé (token expirant, route publique dédiée) pour noter 1–5 + commentaire.
2. Backend : table `ticket_satisfaction` (ticket_id, note 1-5, commentaire, token hash, expiré/consommé, created_at) — migration 0018 ; routes publiques `POST /public/tickets/:id/satisfaction` (Bearer public ou token) et stats dans `public-support`.
3. Frontend : page publique légère de notation (intégrable au portail) + bloc « Satisfaction » dans les stats support public (moyenne, distribution).

## Fichiers

- `src/modules/comments/comments.service.ts`, `services/public-reply-persistence.service.ts`
- `src/modules/tickets/*` (route public-reply), `src/modules/support-satisfaction/*` (nouveau)
- `src/database/schemas/*`, migration 0018
- `public-frontend/src/features/requests/ticket-detail.tsx`, `src/app/.../satisfaction`
- `frontend/src/features/tickets/ticket-actions.tsx`
- templates email `src/modules/email/templates/*`

## Risques

- Sécurité du lien de satisfaction : token opaque haché en base, expiration (ex. 14 jours), une seule soumission.
- Changement de comportement des commentaires (option B) : risque de régression → gate de tests E2E publics.

## Critères de validation

- Réponse publique : timeline du demandeur mise à jour + email reçu (Mailpit), commentaire classique non exposé au demandeur.
- Satisfaction : soumission unique, note visible dans les stats support public, token expiré refusé.
- Statistiques support public enrichies (moyenne note, taux de réponse).

## Tests

- Unitaires : persistance réponse publique, token satisfaction (expiration, hash, unicité).
- E2E : parcours demandeur (commentaire interne invisible, réponse publique visible), notation.
## Statut de la phase
- FAIT (pouss�) : option B � route POST /tickets/:id/public-reply + action � R�pondre au demandeur �. V�rifi� live.
- EN COURS : satisfaction (note 1-5 + lien sign�) et bascule commentaires internes uniquement.
