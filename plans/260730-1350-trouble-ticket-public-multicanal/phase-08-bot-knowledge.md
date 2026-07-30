# Phase 08 — Bot et connaissance publique

## Contexte

Le formulaire, les conversations et le transfert humain sont déjà opérationnels. Le bot améliore l’admission mais ne devient ni autorité métier ni dépendance bloquante.

## Vue d’ensemble

Ajouter une base documentaire publique simple, une abstraction de fournisseur IA, une liste fermée d’outils et le parcours brouillon/confirmation/handoff.

## Exigences

- Aucun fournisseur factice en production.
- Fournisseur, modèle, région de traitement et politique de données approuvés avant activation.
- Documentation cloisonnée par intégration et explicitement publique.
- Aucun accès aux notes internes, audits, secrets ou endpoints arbitraires.
- Création uniquement après confirmation, sauf transfert humain explicite.
- Limites de coût, temps, tours et appels outils.
- Formulaire disponible pendant toute panne IA.

## Architecture

`SupportBotService` orchestre un fournisseur derrière `AiProvider`, mais les outils appellent des cas d’usage publics déterministes. `ToolPolicyService` valide l’état de conversation, l’intégration et l’autorisation avant chaque appel. La connaissance commence avec recherche PostgreSQL simple sur articles éditorialisés.

## Étapes

1. Ajouter `support-knowledge` : articles, versions, intégrations autorisées, langue, état brouillon/publié et audit.
2. Ajouter les tables au schéma expand si la phase 01 n’est pas déployée ; sinon créer une migration additive dédiée.
3. Créer administration interne de la connaissance sans ingérer automatiquement des données privées.
4. Implémenter recherche textuelle simple ; mesurer rappel et latence avant toute base vectorielle.
5. Créer `ai-provider.interface.ts`, types stricts de réponse et un seul adaptateur réel après décision fournisseur.
6. Créer `tool-policy.service.ts` avec allowlist : recherche, catégories, brouillon, création confirmée, consultation, message et handoff.
7. Enregistrer version de prompt, modèle, outils appelés, latence, coût estimé et confiance, sans raisonnement interne du modèle.
8. Implémenter détection de faible confiance, échecs répétés, demande humaine et sujets sensibles.
9. Traiter les pièces jointes et textes utilisateurs comme données non fiables, jamais comme instructions d’autorisation.
10. Ajouter résumé agent clairement marqué comme assistance et corrigeable.
11. Ajouter au frontend public l’interface conversationnelle, le brouillon éditable et le bouton formulaire permanent.
12. Ajouter feature flag, budget par intégration, coupe-circuit et fallback déterministe.

## Fichiers principaux

- `src/modules/support-knowledge/**`
- `src/modules/support-bot/interfaces/ai-provider.interface.ts`
- `src/modules/support-bot/services/support-bot.service.ts`
- `src/modules/support-bot/services/tool-policy.service.ts`
- `src/modules/support-bot/services/handoff-policy.service.ts`
- `public-frontend/src/features/conversation/**`
- `frontend/src/features/tickets/ticket-detail.tsx`

## Todo et tests

- [ ] Cloisonnement des articles par intégration et état publié.
- [ ] Prompt injection, outil interdit, note interne et endpoint arbitraire.
- [ ] Confirmation obligatoire et brouillon modifiable.
- [ ] Handoff par demande, faible confiance, erreur et sujet sensible.
- [ ] Budget, timeout, coupe-circuit et fournisseur indisponible.
- [ ] Mesure sur jeu de cas réel anonymisé avant activation pilote.

## Critères de succès

- Le bot améliore la complétude sans décider du routage final.
- Une panne ou un quota atteint ramène immédiatement au formulaire.
- Aucun contenu privé ne rejoint la connaissance publique.
- Les agents peuvent mesurer et corriger les classifications proposées.
