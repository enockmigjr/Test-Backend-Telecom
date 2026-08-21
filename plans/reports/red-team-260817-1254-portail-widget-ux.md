# Revue adversariale — Refonte portail/widget

## Verdict initial

PAS PRÊT pour implémentation avant le plan : mapping métier des quatre catégories non confirmé.

## P0 détectés et résolution

1. Mapping de catégories potentiellement erroné — résolution intégrée en Phase 02 : confirmation explicite, sauvegarde de la configuration, mise à jour ciblée seulement.
2. Risque de casser le contrat iframe — résolution intégrée en Phase 01/03 : conserver handshake, cookies, CSP et ajouter tests viewport/E2E.

## P1 détectés et résolution

1. Responsive non prouvé par le test actuel — assertions multi-viewport ajoutées en Phase 01.
2. Widget pouvant avoir une hauteur calculée supérieure au viewport — dimensionnement `dvh/svh` et scroll interne exigés en Phase 01.
3. Fallback cookies tiers visuellement dominant — réduction et test de visibilité exigés en Phase 01.
4. Catalogue vide pouvant être masqué par le formulaire — état catalogue vide/erreur explicite exigé en Phase 01.

## Seconde lecture

Le plan sépare correctement le correctif de données du travail visuel, interdit les changements de sécurité implicites, et prévoit les preuves runtime du connecteur.

## Verdict final

PRÊT SOUS CONDITION : implémentation autorisée après confirmation utilisateur du mapping des catégories et validation explicite du plan.
