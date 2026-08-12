# Catalogue Complet des Routes API

**Source** : `openapi.json` (généré par `pnpm run openapi:export`) — contrat réel vérifié : **120 chemins / 144 opérations** (dont 33 opérations publiques dans `openapi.public.json`).
**Base URL** : `http://localhost:${API_PORT:-3000}/${API_PREFIX:-api/v1}`
**Documentation interactive** : `http://localhost:${API_PORT:-3000}/api/docs`

> Ce catalogue est généré depuis le contrat OpenAPI ; il remplace les versions écrites à la main qui n'étaient plus à jour.

## Résumé par tag

| Tag | Opérations |
| --- | --- |
| tickets | 15 |
| Support public - demandes | 12 |
| dashboard | 10 |
| reports | 9 |
| support-integrations | 9 |
| users | 9 |
| Support public - identité | 7 |
| auth | 6 |
| attachments | 5 |
| categories | 5 |
| comments | 5 |
| departments | 5 |
| external-requesters | 5 |
| internal-notes | 4 |
| notifications | 4 |
| Support public - pièces jointes pré-ticket | 4 |
| Support public - pièces jointes | 4 |
| sla | 4 |
| support-knowledge | 4 |
| audit-logs | 2 |
| external-deliveries | 2 |
| health | 2 |
| Support public - connaissance | 2 |
| Support public - appareils | 2 |
| Settings | 2 |
| root | 1 |
| metrics | 1 |
| Support public - configuration | 1 |
| Support public - bot | 1 |
| Support public - satisfaction | 1 |
| Tickets - satisfaction | 1 |

**Total : 144 opérations sur 120 chemins.**

## attachments

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `POST` | `/attachments` | Uploader une piece jointe | Bearer JWT |
| `DELETE` | `/attachments/{id}` | Supprimer une piece jointe visible | Bearer JWT |
| `GET` | `/attachments/{id}/download` | Telecharger une piece jointe visible | Bearer JWT |
| `GET` | `/attachments/{id}/preview` | Prévisualiser une pièce jointe visible | Bearer JWT |
| `GET` | `/tickets/{ticketId}/attachments` | Lister les pieces jointes visibles d'un ticket | Bearer JWT |

## audit-logs

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/audit-logs` | Consulter les journaux d'audit | Bearer JWT |
| `GET` | `/audit-logs/{id}` | Détail d'un événement d'audit | Bearer JWT |

## auth

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `PUT` | `/auth/change-password` | Changer le mot de passe | Bearer JWT |
| `POST` | `/auth/login` | Connexion utilisateur | Public |
| `POST` | `/auth/logout` | Déconnexion (révoque le refresh token + blackliste l'access token) | Bearer JWT |
| `POST` | `/auth/logout-all` | Déconnexion de toutes les sessions actives | Bearer JWT |
| `GET` | `/auth/me` | Profil de l'utilisateur connecté | Bearer JWT |
| `POST` | `/auth/refresh` | Rafraîchir la paire de tokens (rotation) | Public |

## categories

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/categories` | Liste de toutes les catégories | Bearer JWT |
| `POST` | `/categories` | Créer une catégorie (Admin uniquement) | Bearer JWT |
| `DELETE` | `/categories/{id}` | Supprimer une catégorie (Admin uniquement) | Bearer JWT |
| `GET` | `/categories/{id}` | Détails d'une catégorie | Bearer JWT |
| `PATCH` | `/categories/{id}` | Modifier une catégorie (Admin uniquement) | Bearer JWT |

## comments

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `DELETE` | `/comments/{id}` | Supprimer un commentaire | Bearer JWT |
| `PATCH` | `/comments/{id}` | Modifier un commentaire | Bearer JWT |
| `GET` | `/tickets/{ticketId}/comments` | Commentaires publics d'un ticket | Bearer JWT |
| `POST` | `/tickets/{ticketId}/comments` | Ajouter un commentaire public | Bearer JWT |
| `POST` | `/tickets/{ticketId}/public-reply` | Répondre au demandeur externe | Bearer JWT |

## dashboard

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/dashboard/agent-performance` | Performance des agents | Bearer JWT |
| `GET` | `/dashboard/departments` | Performance par département | Bearer JWT |
| `GET` | `/dashboard/my-activity` | Mon activité | Bearer JWT |
| `GET` | `/dashboard/overview` | KPIs globaux de la plateforme | Bearer JWT |
| `GET` | `/dashboard/public-support` | Statistiques du support public | Bearer JWT |
| `GET` | `/dashboard/resolution-time` | Temps moyen de résolution | Bearer JWT |
| `GET` | `/dashboard/sla-compliance` | Conformité SLA détaillée | Bearer JWT |
| `GET` | `/dashboard/tickets-by-priority` | Tickets par priorité avec breaches SLA | Bearer JWT |
| `GET` | `/dashboard/tickets-by-status` | Tickets par statut avec âge moyen | Bearer JWT |
| `GET` | `/dashboard/workload` | Charge des agents + tickets non assignés | Bearer JWT |

## departments

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/departments` | Liste des départements (outil interne) | Bearer JWT |
| `POST` | `/departments` | Créer un département (Admin uniquement) | Bearer JWT |
| `DELETE` | `/departments/{id}` | Supprimer un département (Admin uniquement, soft delete) | Bearer JWT |
| `GET` | `/departments/{id}` | Détails d'un département | Bearer JWT |
| `PATCH` | `/departments/{id}` | Modifier un département (Admin uniquement) | Bearer JWT |

## external-deliveries

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/external-deliveries` | Liste paginée des livraisons externes | Bearer JWT |
| `GET` | `/external-deliveries/{id}` | Consulter une livraison externe | Bearer JWT |

## external-requesters

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/external-requesters` | Liste paginée des demandeurs publics | Bearer JWT |
| `GET` | `/external-requesters/{id}` | Consulter un demandeur public | Bearer JWT |
| `POST` | `/external-requesters/{id}/anonymize` | Anonymiser un demandeur public | Bearer JWT |
| `POST` | `/external-requesters/{id}/merge` | Fusionner un demandeur public vers un profil cible | Bearer JWT |
| `POST` | `/external-requesters/{id}/merge/preview` | Aperçu d’une fusion de profils demandeur | Bearer JWT |

## health

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/health` | Liveness check — le processus est-il vivant ? | Public |
| `GET` | `/health/ready` | Readiness check — les dépendances sont-elles connectées ? | Public |

## internal-notes

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `DELETE` | `/internal-notes/{id}` | Supprimer une note interne | Bearer JWT |
| `PATCH` | `/internal-notes/{id}` | Modifier une note interne | Bearer JWT |
| `GET` | `/tickets/{ticketId}/internal-notes` | Notes internes d'un ticket | Bearer JWT |
| `POST` | `/tickets/{ticketId}/internal-notes` | Ajouter une note interne | Bearer JWT |

## metrics

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/metrics` | Métriques Prometheus (format OpenMetrics) | Public |

## notifications

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/notifications` | Notifications de l'utilisateur connecté | Bearer JWT |
| `PATCH` | `/notifications/{id}/read` | Marquer une notification comme lue | Bearer JWT |
| `PATCH` | `/notifications/read-all` | Marquer toutes les notifications comme lues | Bearer JWT |
| `GET` | `/notifications/unread` | Notifications non lues | Bearer JWT |

## reports

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/reports` | Lister les rapports générés | Bearer JWT |
| `GET` | `/reports/{id}` | Consulter l'état d'un rapport généré | Bearer JWT |
| `GET` | `/reports/{id}/download` | Télécharger le PDF d un rapport généré | Bearer JWT |
| `GET` | `/reports/public/{id}/download` | Télécharger un rapport depuis un lien signé et temporaire | Public |
| `GET` | `/reports/sla` | Rapport SLA sur une période (synchrone — données JSON) | Bearer JWT |
| `POST` | `/reports/sla/generate` | Générer un rapport SLA PDF (asynchrone) | Bearer JWT |
| `GET` | `/reports/ticket/{id}` | Obtenir les données du rapport d un ticket (synchrone — données JSON) | Bearer JWT |
| `POST` | `/reports/ticket/{id}/generate` | Générer un rapport PDF détaillé pour un ticket (asynchrone) | Bearer JWT |
| `POST` | `/reports/weekly/generate` | Générer un rapport hebdomadaire PDF (asynchrone) | Bearer JWT |

## root

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/` | Informations sur l'API | Public |

## Settings

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/settings` | Lister tous les paramètres système globaux | Bearer JWT |
| `PATCH` | `/settings/{key}` | Mettre à jour un paramètre système par sa clé | Bearer JWT |

## sla

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/sla-policies` | Liste des politiques SLA | Bearer JWT |
| `POST` | `/sla-policies` | Créer une politique SLA (Admin) | Bearer JWT |
| `GET` | `/sla-policies/{id}` | Détails d'une politique SLA | Bearer JWT |
| `PATCH` | `/sla-policies/{id}` | Modifier les délais SLA (Admin) | Bearer JWT |

## Support public - appareils

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/public-support/session/devices` | Lister les appareils de confiance du demandeur | Session publique |
| `DELETE` | `/public-support/session/devices/{id}` | Révoquer un appareil de confiance précis | Session publique |

## Support public - bot

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `POST` | `/public-support/conversations/{id}/bot` | Envoyer un message au bot de la conversation | Session publique |

## Support public - configuration

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/public-support/config` | Charger la configuration publique bornée d'une intégration | Public |

## Support public - connaissance

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/public-support/knowledge/{slug}` | Consulter un article public par slug | Session publique |
| `GET` | `/public-support/knowledge/search` | Rechercher des articles publics de cette intégration | Session publique |

## Support public - demandes

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/public-support/catalog` | Catalogue public autorisé pour cette intégration | Session publique |
| `POST` | `/public-support/conversations` | Démarrer une conversation de support | Session publique |
| `GET` | `/public-support/conversations/{id}` | Reprendre une conversation ou son brouillon | Session publique |
| `POST` | `/public-support/conversations/{id}/confirm` | Confirmer et créer atomiquement le ticket | Session publique |
| `PATCH` | `/public-support/conversations/{id}/draft` | Enregistrer le brouillon qualifié | Session publique |
| `POST` | `/public-support/conversations/{id}/handoff` | Demander explicitement un transfert humain | Session publique |
| `GET` | `/public-support/preferences` | Consulter le profil public conservé | Session publique |
| `PATCH` | `/public-support/preferences` | Mettre à jour le nom et la langue du profil public | Session publique |
| `GET` | `/public-support/tickets` | Lister uniquement les demandes du contact courant | Session publique |
| `GET` | `/public-support/tickets/{id}` | Consulter une demande publique | Session publique |
| `POST` | `/public-support/tickets/{id}/comments` | Ajouter un commentaire demandeur | Session publique |
| `GET` | `/public-support/tickets/{id}/timeline` | Consulter la timeline publique filtrée | Session publique |

## Support public - identité

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `POST` | `/public-support/identity/assertion/exchange` | Échanger une assertion signée contre une session publique | Assertion signée |
| `POST` | `/public-support/identity/email/consume` | Vérifier le code et ouvrir une session publique | Public |
| `POST` | `/public-support/identity/email/request` | Demander un code de vérification email | Public |
| `POST` | `/public-support/session/bootstrap/consume` | Consommer une fois un code de transfert | Public |
| `POST` | `/public-support/session/bootstrap/request` | Créer un code de transfert iframe vers pleine page | Session publique |
| `POST` | `/public-support/session/restore` | Restaurer et faire tourner la confiance de l’appareil | Appareil de confiance + clé |
| `POST` | `/public-support/session/revoke-device` | Révoquer l’appareil courant | Session publique |

## Support public - pièces jointes

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/public-support/tickets/{ticketId}/attachments` | Lister les pièces jointes et leur état de scan | Session publique |
| `POST` | `/public-support/tickets/{ticketId}/attachments` | Déposer une pièce jointe en quarantaine | Session publique |
| `GET` | `/public-support/tickets/{ticketId}/attachments/{attachmentId}/download` | Télécharger uniquement une pièce jointe déclarée saine | Session publique |
| `GET` | `/public-support/tickets/{ticketId}/attachments/{attachmentId}/status` | Consulter l'état d'analyse d'une pièce jointe | Session publique |

## Support public - pièces jointes pré-ticket

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/public-support/conversations/{conversationId}/attachments` | Lister les fichiers de la conversation | Session publique |
| `POST` | `/public-support/conversations/{conversationId}/attachments` | Déposer un fichier avant création du ticket | Session publique |
| `GET` | `/public-support/conversations/{conversationId}/attachments/{attachmentId}/download` | Télécharger un fichier pré-ticket sain | Session publique |
| `GET` | `/public-support/conversations/{conversationId}/attachments/{attachmentId}/status` | Consulter l'état du scan | Session publique |

## Support public - satisfaction

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `POST` | `/public-support/tickets/{ticketId}/satisfaction` | Soumettre une note de satisfaction | Public |

## support-integrations

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/support-integrations` | Lister les intégrations sans exposer leurs secrets | Bearer JWT |
| `POST` | `/support-integrations` | Créer une intégration de support en brouillon | Bearer JWT |
| `GET` | `/support-integrations/{id}` | Consulter une intégration | Bearer JWT |
| `PATCH` | `/support-integrations/{id}` | Modifier politiques, origines ou statut | Bearer JWT |
| `GET` | `/support-integrations/{id}/credentials` | Lister les versions de secret sans exposer leur valeur chiffrée | Bearer JWT |
| `POST` | `/support-integrations/{id}/credentials/{credentialId}/revoke` | Révoquer une version de secret | Bearer JWT |
| `POST` | `/support-integrations/{id}/credentials/rotate` | Chiffrer une nouvelle version de secret sans la retourner | Bearer JWT |
| `GET` | `/support-integrations/{id}/devices` | Lister les appareils de confiance sans exposer leurs jetons | Bearer JWT |
| `POST` | `/support-integrations/{id}/devices/{deviceId}/revoke` | Révoquer un appareil de confiance | Bearer JWT |

## support-knowledge

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/support-knowledge` | Liste paginée des articles de connaissance | Bearer JWT |
| `POST` | `/support-knowledge` | Créer un article de connaissance | Bearer JWT |
| `GET` | `/support-knowledge/{id}` | Consulter un article avec son historique | Bearer JWT |
| `PATCH` | `/support-knowledge/{id}` | Modifier, publier ou archiver un article | Bearer JWT |

## tickets

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/tickets` | Rechercher des tickets | Bearer JWT |
| `POST` | `/tickets` | Créer un ticket d'incident | Bearer JWT |
| `DELETE` | `/tickets/{id}` | Supprimer un ticket (soft delete, Admin uniquement) | Bearer JWT |
| `GET` | `/tickets/{id}` | Détails d'un ticket | Bearer JWT |
| `PATCH` | `/tickets/{id}` | Mettre à jour un ticket | Bearer JWT |
| `POST` | `/tickets/{id}/assign` | Assigner un ticket à un agent | Bearer JWT |
| `POST` | `/tickets/{id}/close` | Clôturer un ticket résolu | Bearer JWT |
| `POST` | `/tickets/{id}/escalate` | Escalader un ticket | Bearer JWT |
| `GET` | `/tickets/{id}/history` | Historique complet d'un ticket | Bearer JWT |
| `POST` | `/tickets/{id}/pending-customer` | Mettre en attente du client (IN_PROGRESS -> PENDING_CUSTOMER) | Bearer JWT |
| `POST` | `/tickets/{id}/pending-third-party` | Mettre en attente tiers (IN_PROGRESS -> PENDING_THIRD_PARTY) | Bearer JWT |
| `POST` | `/tickets/{id}/reassign` | Réassigner un ticket à un autre agent | Bearer JWT |
| `POST` | `/tickets/{id}/reopen` | Réouvrir un ticket clôturé | Bearer JWT |
| `POST` | `/tickets/{id}/resolve` | Marquer un ticket comme résolu | Bearer JWT |
| `POST` | `/tickets/{id}/start` | Démarrer le traitement d'un ticket | Bearer JWT |

## Tickets - satisfaction

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `POST` | `/tickets/{ticketId}/satisfaction-token` | Générer un lien de satisfaction | Bearer JWT |

## users

| Méthode | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/users` | Liste paginée des utilisateurs | Bearer JWT |
| `POST` | `/users` | Créer un utilisateur | Bearer JWT |
| `GET` | `/users/{id}` | Détails d'un utilisateur | Bearer JWT |
| `PATCH` | `/users/{id}` | Modifier un utilisateur | Bearer JWT |
| `PATCH` | `/users/{id}/activate` | Réactiver un compte | Bearer JWT |
| `PATCH` | `/users/{id}/deactivate` | Désactiver un compte | Bearer JWT |
| `GET` | `/users/me` | Profil de l'utilisateur connecté | Bearer JWT |
| `PATCH` | `/users/me/absence` | Déclarer / annuler son absence | Bearer JWT |
| `PATCH` | `/users/me/availability` | Mettre en pause / reprendre (self-service) | Bearer JWT |
