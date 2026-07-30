# Revue adversariale du plan

## Verdict initial

Non prêt : cinq P0 et cinq P1 devaient être corrigés avant implémentation.

## P0 détectés et résolution

1. Colonnes acteur internes encore `NOT NULL` : phase 01 précise `DROP NOT NULL`, colonnes par table, `CHECK NOT VALID`, backfill et propagation aux événements/consommateurs.
2. Console agents adaptée trop tard : ajout de la phase 01b obligatoire avant toute création publique.
3. Plugin WordPress ignoré par Git : phase 06 impose négations ciblées, `check-ignore`, `ls-files` et présence du code dans le SHA WordPress.
4. Gardes publics ambigus : phase 02 définit `AuthMode` discriminé et un garde global d’orchestration avec défaut interne.
5. Fallback iframe incomplet : phases 02 et 05 définissent cookies séparés, CSRF synchronizer et bootstrap fragment → POST à usage unique.

## P1 détectés et résolution

1. Exactly-once externe impossible : phase 03 assume at-least-once, déduplication locale et `DELIVERY_UNKNOWN`.
2. Réponse livrée modifiable : phases 03 et 07 rendent la réponse append-only et utilisent une correction liée.
3. Pièce jointe multi-parent : phases 01 et 04 imposent `num_nonnulls(...) = 1` et parent canonique.
4. `file-type`, ClamAV et queues non raccordés : phase 04 ajoute spike CommonJS, protocole fail-closed, lifecycle, health et Bull Board.
5. OpenAPI public trop large : phases 00, 03 et 05 ajoutent une projection publique distincte et testée.

## Condition de clôture

Une seconde lecture doit confirmer que les corrections apparaissent dans le plan et que chaque fichier reste sous 200 lignes.

## Seconde lecture

Deux P0 supplémentaires ont été corrigés : migration explicite des routes `@Public()` existantes vers `AuthMode.ANONYMOUS`, et enregistrement complet de la queue livraison en phase 03. Les formulations exactly-once, rollback SQL et « trois dépôts » ont également été rectifiées.

## Verdict final

PRÊT : troisième vérification ciblée sans P0 ni P1 restant.
