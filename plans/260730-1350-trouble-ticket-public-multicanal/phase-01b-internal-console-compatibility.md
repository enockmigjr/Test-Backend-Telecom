# Phase 01b — Compatibilité obligatoire de la console interne

## Statut

- Terminée et commitée.

## Contexte

Après la migration additive, le backend peut représenter un acteur externe ou système. Le frontend interne actuel rejette encore les champs acteur absents avec Zod.

## Vue d’ensemble

Déployer une compatibilité minimale backend/OpenAPI/frontend avant d’autoriser la première création publique. Les écrans administratifs avancés restent en phase 07.

## Exigences

- Aucune route publique de création activée avant cette phase.
- Les tickets historiques internes conservent exactement leur affichage et leurs permissions.
- Les unions discriminées remplacent les UUID internes obligatoires.
- Les réponses, historiques, audits et pièces jointes affichent un libellé sûr pour chaque acteur.
- Aucune donnée publique ne contourne les permissions internes existantes.

## Architecture

Le backend expose durant la transition les champs legacy et le nouvel acteur. Le frontend parse le nouvel acteur, avec adaptateur legacy uniquement pour les enregistrements backfillés. Ce fallback est mesuré et retiré en phase 09.

## Étapes

1. Mettre à jour schémas OpenAPI tickets, commentaires, historique, pièces jointes, audit et affectations.
2. Réexporter le contrat complet et mettre à jour `frontend/contracts/openapi.json`.
3. Régénérer `frontend/src/lib/api/schema.d.ts` sans édition manuelle.
4. Adapter `frontend/src/features/tickets/schemas.ts` à `INTERNAL | EXTERNAL_REQUESTER | SYSTEM`.
5. Adapter `permissions.ts` lorsque `openedByUserId` est absent ; un demandeur externe n’est jamais propriétaire agent.
6. Adapter ticket détail, discussion, historique et pièces jointes aux identifiants internes nullables.
7. Adapter les écrans audit et rapports qui supposent `userId` obligatoire.
8. Afficher un demandeur minimal et le canal ; différer résumé bot, fusion, livraisons et administration à la phase 07.
9. Ajouter métrique du fallback legacy et tests prouvant que les anciens enregistrements restent lisibles.
10. Déployer backend expand/backfill puis frontend compatible avant de lever le flag de création publique.

## Fichiers principaux

- `src/common/openapi/ticket-domain.schemas.ts`
- `src/common/openapi/collaboration-domain.schemas.ts`
- `src/common/openapi/report-domain.schemas.ts`
- `frontend/src/features/tickets/schemas.ts`
- `frontend/src/features/tickets/permissions.ts`
- `frontend/src/features/tickets/ticket-detail.tsx`
- `frontend/src/features/tickets/discussion-panel.tsx`
- `frontend/src/features/tickets/ticket-history.tsx`
- `frontend/src/features/audit/**`, `frontend/src/features/reports/**`

## Todo et tests

- [x] Contrat généré et Zod couvrent tous les acteurs et valeurs legacy.
- [x] Permissions avec créateur interne, externe, système et absent.
- [x] Historique, audit, commentaire et pièce jointe sans utilisateur interne.
- [x] Régression tickets internes, filtres, pagination, mutations et temps réel.
- [x] Jalon frontend interne : contrat, lint, typecheck, tests, build et E2E tickets.

Implémentation clôturée côté console interne par `4a5ef43`, après le socle backend `cdf3d94`.

## Critères de succès

- La console ouvre un ticket public sans erreur de validation.
- Les actions autorisées restent calculées depuis l’utilisateur interne connecté.
- Aucun champ sensible externe n’est exposé par défaut.
- Le flag de création publique demeure fermé tant que ce jalon n’est pas déployé.
