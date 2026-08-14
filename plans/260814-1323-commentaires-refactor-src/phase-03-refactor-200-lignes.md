# Phase 03 — Refactor des 36 fichiers > 200 lignes

## Statut
- À lancer après les phases 01/02 (ou en parallèle sur les gros fichiers, avec frontières disjointes).

## Contexte
36 fichiers dépassent 200 lignes. Les 21 fichiers de production à logique dense sont prioritaires (tickets, dashboard, reports, users, seed, workers, SLA, external-delivery) ; les 15 spec seront découpées seulement si leur taille nuit à la lisibilité.

## Exigences
- Comportement strictement identique : aucune modification de logique, de requête, de contrat, de visibilité publique.
- Extraction vers de nouveaux fichiers kebab-case < 200 lignes dans le même répertoire (ex. `tickets.service-helpers.ts` interdit ; préférer des noms métier comme `ticket-assignment.policy.ts`).
- Mettre à jour les imports et le module NestJS si un nouveau provider est créé.
- Ajuster les spec uniquement si un import change ; ne jamais affaiblir un cas de test.
- Lancer `pnpm build` et les tests ciblés du module après chaque sous-lot.

## Sous-lots (production)
- 3A : `tickets.service.ts` (683), `tickets.controller.ts` (411), `assignment-engine.service.ts` (327), `auto-assignment.cron.ts` (325)
- 3B : `dashboard.service.ts` (730), `dashboard.controller.ts` (269)
- 3C : `reports.service.ts` (502), `reports.controller.ts` (256), `report.worker.ts` (453)
- 3D : `users.service.ts` (483), `external-requesters-admin.service.ts` (468), `external-delivery.service.ts` (268)
- 3E : `ticket-notification.listener.ts` (539), `sla-alert-processor.service.ts` (313), `sla-alert-notifier.service.ts` (201)
- 3F : `run-seed.ts` (1141), `support-bot.service.ts` (261), `support-knowledge.service.ts` (249), `comments.service.ts` (222), `jwt.strategy.ts` (258), `ticket-permissions.ts` (267)
- 3G : les 15 spec > 200 lignes (découpage des données de test en fixtures si pertinent)

## Critères de succès
- Chaque fichier de production restant ≤ 200 lignes ou justifié (ex. seed data volumineuse) avec logique dense extraite.
- `pnpm build`, lint, `pnpm test:unit` verts.
- Aucune modification de comportement détectée par les tests existants.
