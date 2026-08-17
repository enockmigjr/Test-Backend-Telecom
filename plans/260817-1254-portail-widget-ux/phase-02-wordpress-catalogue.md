# Phase 02 — Intégration WordPress et catalogue

## Statut
- État : terminée ; migration 0022 appliquée dans Compose et quatre catégories vérifiées en SQL.

## Architecture
Le connecteur WordPress ne fournit pas les catégories : il charge `/widget/v2/widget.js`, puis le widget appelle le BFF `/api/public/catalog`. Le backend résout l’intégration par clé publique et filtre les catégories par `routingPolicy.allowedCategoryIds`.

## Fichiers/configuration ciblés
- Vérifier `C:/xampp/htdocs/site-wordpress1/wp-content/plugins/trouble-ticket-connector/inc/widget-renderer.php` sans modification fonctionnelle nécessaire a priori.
- Ajouter un test de configuration/catalogue côté plugin si la harness existante le permet.
- Mettre à jour la donnée `support_integrations.routing_policy` via une opération contrôlée/documentée, sans migration destructive.
- Ajouter ou renforcer le test frontend du catalogue non vide.

## Étapes
1. Mapper les quatre anciennes entrées vers `BILLING`, `HARDWARE`, `NETWORK` et `OTHER`, les quatre catégories réelles configurées pour cette intégration.
2. Sauvegarder la ligne d’intégration non secrète et enregistrer les anciens/nouveaux UUID dans le rapport.
3. Mettre à jour uniquement `allowedCategoryIds` et conserver les routes existantes quand elles restent valides.
4. Vérifier `GET /api/v1/public-support/catalog` avec le flux d’authentification public approprié.
5. Le connecteur WordPress reste inchangé fonctionnellement : il charge le loader public, qui consomme désormais le catalogue réparé.

## Gates
- Ne pas inventer de catégorie ni supprimer une catégorie active.
- Ne pas exposer la clé publique, secret ou assertion dans les logs/rapports.
- Si le mapping métier n’est pas confirmé, arrêter cette phase et livrer le diagnostic sans modification de données.
