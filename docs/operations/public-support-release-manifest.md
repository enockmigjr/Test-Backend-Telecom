# Manifest de release du support public

Statut : baseline technique de phase 00, pas une release de production

## Snapshot de départ

| Élément | Valeur vérifiée |
|---|---|
| Backend avant phase 00 | `ea60be43c2fa680d6843271b1caf091bf1ef29a0` |
| Frontend interne | `7760131508042ea2392a84b82fb54acacdf7f154` |
| WordPress PhotoVault | `b40f29fc7d2d09be0b3341ac59760883e1cf511d` |
| Frontend public | non créé, conformément au séquencement |
| SHA-256 `openapi.json` | `C461CF16B9A694421D66EDA9294B64F59B043140E1AEC7C901FEC2B55CA11373` |
| SHA-256 `openapi.public.json` | `55E5A9573E5AC473D04BEF3888EA7B8C1E0AFA6EE3F77CF473A8E5D051A6B0AB` |
| Opérations internes/publiques | `83 / 0` |

## Champs obligatoires d’une release

Chaque déploiement doit enregistrer :

- identifiant de release, environnement et horodatage UTC ;
- SHA propres des quatre dépôts ;
- hashes des contrats interne et public ;
- digests immuables des images ;
- plage de migrations appliquées ;
- intégrations et feature flags activés ;
- résultats des gates backend, frontends, WordPress et infrastructure ;
- approbateurs produit, sécurité et exploitation ;
- procédure et résultat du rollback par flags.

Un worktree sale, un composant exécuté non suivi ou un contrat généré différent invalide le manifest.

## Règles par dépôt

- Backend : suit schémas, migrations, workers, contrats et documentation.
- Frontend interne : SHA compatible avec le contrat interne exact.
- Frontend public : SHA compatible avec le hash de `openapi.public.json`.
- WordPress : le SHA doit contenir le plugin actif et son miroir, prouvés par `git ls-files`.

Le SHA d’un commit ne peut pas être auto-inscrit dans le même commit. Le pipeline de release produit donc le manifest final après checkout des quatre SHA, sans réécrire les sources.

## Vérifications de baseline

```powershell
pnpm run openapi:export
pnpm run openapi:check
git ls-files --error-unmatch openapi.json openapi.public.json
git diff --exit-code -- openapi.json openapi.public.json
git status --short -- openapi.json openapi.public.json
git -C frontend status --short
git -C C:\xampp\htdocs\site-wordpress1 status --short
```

La phase 00 ne crée ni migration, ni route publique, ni frontend public. Toute valeur ajoutée au manifest doit provenir d’un artefact ou d’une commande vérifiable.
