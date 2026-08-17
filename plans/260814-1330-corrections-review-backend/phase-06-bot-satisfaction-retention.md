# Phase 06 — Bot, satisfaction et rétention publique

## Statut

- Prévu — dépend de Phase 00 (parallélisable avec 03/04/05)
- Findings traités : **P1-12** (budget IA bot contournable), **P2-31** (satisfaction usage unique non atomique), **P2-32** (challenges OTP PENDING jamais purgés), **P2-33** (quotas OTP IP spoofables — décision D2), **P2-34** (circuit breaker bot par instance), **P2-35** (anonymisation partielle), **P2-36** (tool loop bot incomplète), **P3-k** (tool-policy 'OPEN' en dur), **P3-i** (prénom agent exposé), **P3-ad** (wildcards LIKE non échappés), **P3-ae** (content complet dans recherche)

## Contexte

Le portail public est bien cloisonné (aucun P0), mais ses garde-fous ont des angles morts : le budget IA du bot est un check-then-act (contournable par concurrence), le lien de satisfaction « à usage unique » peut être consommé deux fois par course, les challenges OTP abandonnés ne sont jamais purgés (PII), le circuit breaker est en mémoire par instance, et l'anonymisation laisse le contenu des tickets ré-identifiable.

## Vue d'ensemble

1. **P1-12** : compteur atomique Redis (`INCR` + `EXPIRE` au premier hit, fail-closed) consommé **avant** l'appel provider (au lieu du count DB après) ; ou verrou distribué par intégration.
2. **P2-31** : `UPDATE ... SET consumedAt = now() WHERE id = ... AND consumedAt IS NULL .returning()` ; absence de ligne → conflit.
3. **P2-32** : étendre la purge de rétention aux challenges `PENDING AND expiresAt < now()` (ou expirer via le cron existant).
4. **P2-33 (décision D2)** : documenter la règle réseau (port NestJS privé derrière nginx) ; si exposition directe possible, passer sur `X-Real-IP` fixé par nginx et `trust proxy` stricte (liste d'adresses).
5. **P2-34** : circuit breaker partagé Redis (compteur + fenêtre d'ouverture TTL) OU documenter explicitement le comportement mono-instance (décision à acter).
6. **P2-35** : documenter le périmètre d'anonymisation dans le contrôleur/OpenAPI ; évaluer la neutralisation des champs identifiants des tickets/commentaires (dépend de la rétention légale — décision métier).
7. **P2-36** : boucle agent complète (exécuter les outils puis re-compléter avec les résultats `role: 'tool'`, bornée à MAX_TOOL_ROUNDS) ; la réponse finale doit refléter l'exécution des outils.
8. **P3-k** : passer `conversation.status` à `authorize()` (défense en profondeur).
9. **P3-i** : n'exposer qu'un libellé générique dans la timeline publique (ou rendre configurable par intégration).
10. **P3-ad** : échapper `%`/`_` dans les recherches LIKE (ESCAPE) ; **P3-ae** : ne renvoyer qu'un extrait dans les résultats de recherche.

## Exigences

- Le bot : ne pas casser le mode `disabled`/`unavailable` existant ; le coût LLM reste borné par le budget.
- La rétention : la purge des PENDING ne doit pas casser une demande OTP en cours (délai de grâce à définir, ex. expire + 1 h).

## Étapes

1. Tests rouges : budget dépassé par 2 requêtes concurrentes → 1 seule passe ; satisfaction double soumission → 1 seul enregistrement.
2. Compteur Redis budget bot + tests de concurrence.
3. Atomicité satisfaction + tests.
4. Purge PENDING (avec délai de grâce) + tests.
5. Décision D2 (doc réseau) et D4 circuit breaker (Redis ou doc).
6. Boucle outils bot + tests (provider appelé 2× avec résultats d'outils).
7. Tool-policy status, timeline publique, échappement LIKE, extraits.
8. Tests unitaires publics + E2E portail.

## Fichiers

- **Modifier** : `src/modules/support-bot/services/support-bot.service.ts`, `tool-policy.service.ts`, `src/modules/support-satisfaction/support-satisfaction.service.ts`, `src/modules/external-requesters/services/retention-cleanup.service.ts`, `src/modules/external-identity/services/contact-verification.service.ts` (+ controller IP), `src/modules/external-requesters/services/external-requesters-admin.service.ts`, `src/modules/public-support/services/public-timeline.service.ts`, `src/modules/support-knowledge/services/public-knowledge.service.ts`, specs
- **Créer** : `src/modules/support-bot/services/bot-budget.service.ts` (+ spec), éventuellement `src/common/providers/circuit-breaker-redis.service.ts` (+ spec)

## Todo

- [ ] Compteur Redis budget bot (P1-12)
- [ ] Satisfaction atomique (P2-31)
- [ ] Purge challenges PENDING (P2-32)
- [ ] D2 appliquée (doc réseau / trust proxy) (P2-33)
- [ ] Circuit breaker Redis ou doc (P2-34)
- [ ] Anonymisation : périmètre documenté + décision métier (P2-35)
- [ ] Boucle outils bot (P2-36)
- [ ] tool-policy status réel (P3-k)
- [ ] Timeline anonyme (P3-i)
- [ ] LIKE échappés + extraits (P3-ad/ae)

## Critères de succès

- Budget bot infranchissable en concurrence (test de course).
- Satisfaction à usage unique garanti (test de double soumission).
- Aucune régression sur le portail public (E2E portail verts).
