# 1. Utiliser comme base le serveur Nginx officiel (version 1.27) dans une version Alpine (très légère et rapide)
FROM nginx:1.27-alpine

# 2. Supprimer la configuration par défaut incluse avec Nginx afin d'éviter tout conflit avec nos règles
RUN rm /etc/nginx/conf.d/default.conf

# 3. Copier notre fichier de configuration personnalisé (nginx.conf) à l'intérieur du serveur Nginx
COPY nginx.conf /etc/nginx/nginx.conf

# 4. Déclarer que notre serveur utilisera le port 80 (sites web standard / HTTP) et 443 (sites sécurisés / HTTPS)
EXPOSE 80 443

# 5. Démarrer le serveur Nginx en premier plan pour maintenir le conteneur actif en permanence
CMD ["nginx", "-g", "daemon off;"]
