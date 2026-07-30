# Phase 06 — Connecteur WordPress PhotoVault

## Contexte

PhotoVault possède trois plugins métier actifs et un thème de présentation. L’intégration doit rester un quatrième plugin autonome et réutilisable.

## Vue d’ensemble

Créer `trouble-ticket-connector` dans la source active, ajouter son miroir de distribution et valider l’assertion d’identité ainsi que l’injection du widget.

## Exigences

- Aucun changement WordPress Core, thème ou comportement des trois plugins.
- Aucun ticket, message ou fichier stocké dans WordPress.
- Email vérifié via Identity Security Kit ; téléphone inclus seulement s’il est vérifié.
- Secret jamais rendu au navigateur ou aux logs.
- Assertion courte, audience exacte, intégration, sujet opaque, expiration et nonce.

## Architecture

Le plugin expose un endpoint REST WordPress même origine, réservé à l’utilisateur connecté et protégé par nonce WP. Il signe une assertion HMAC avec un secret d’intégration chiffré ou fourni par constante. Le navigateur la transmet une fois à l’iframe, puis le BFF l’échange contre une session publique.

## Étapes

1. Créer `wp-content/plugins/trouble-ticket-connector/trouble-ticket-connector.php` et des modules `inc/` sous 200 lignes.
2. Ajouter paramètres : URL support, integration ID, origine, secret, mode auto/shortcode, pages, position et libellés.
3. Stocker le secret via constante/env en priorité, sinon chiffrement authentifié lié aux salts WordPress ; masquer sa valeur après enregistrement.
4. Ajouter `assertion-service.php` avec `iss`, `aud`, `integration_id`, sujet opaque, contact, `iat`, `exp` et `jti`.
5. Refuser si Identity Security Kit est absent ou si `identity_security_kit_is_email_verified()` échoue.
6. Utiliser `identity_security_kit_is_phone_verified()` avant d’inclure un téléphone ; ne jamais appeler le helper PhotoVault permissif.
7. Ajouter route REST connectée + nonce, limitation, réponse `no-store` et validation stricte.
8. Ajouter injection par `wp_enqueue_scripts`/`wp_footer` et shortcode, avec échappement et URL autorisée.
9. Ajouter écran admin, test de connexion non sensible, rotation et révocation du secret.
10. Créer `tests/runtime-connector.php` et README d’installation/désinstallation.
11. Modifier le `.gitignore` du dépôt WordPress avec des négations ciblées pour suivre uniquement la source active et son miroir `trouble-ticket-connector` sous leurs parents ré-inclus.
12. Vérifier avant commit avec `git check-ignore` et `git ls-files` que le code réellement exécuté sera versionné dans le dépôt WordPress.
13. Copier vers `wp-content/themes/PhotoVault/plugins/trouble-ticket-connector/` seulement après validation de la source active.
14. Étendre `scripts/check-plugin-mirrors.php`, `tools/check-plugin-sync.php`, `sync-plugins.php`, `Makefile` et workflow CI.

## Fichiers du plugin

- `inc/settings.php`, `inc/secret-storage.php`, `inc/assertion-service.php`
- `inc/rest-routes.php`, `inc/widget-renderer.php`, `inc/admin-page.php`
- `assets/admin.css`, `tests/runtime-connector.php`, `README.md`

## Todo et tests

- [ ] Non connecté, nonce invalide, email non vérifié et Identity Kit absent.
- [ ] Expiration, mauvaise audience, origine hostile, nonce rejoué et rotation.
- [ ] Shortcode, injection automatique, désactivation et CSP bloquante.
- [ ] Syntaxe PHP et standard WordPress ciblé.
- [ ] Test runtime dans Docker/WordPress réel.
- [ ] Vérification des miroirs et tests navigateur PhotoVault, individuellement si longs.
- [ ] Source active et miroir présents dans `git ls-files` du dépôt WordPress.

## Critères de succès

- Un membre PhotoVault vérifié ouvre le widget sans nouvel OTP.
- Un visiteur anonyme conserve le parcours public normal.
- Désactiver le plugin restaure exactement le comportement antérieur du site.
- Les quatre plugins actifs et leurs miroirs sont identiques après synchronisation.
- Le SHA du dépôt WordPress contient réellement le connecteur exécuté et son miroir.
