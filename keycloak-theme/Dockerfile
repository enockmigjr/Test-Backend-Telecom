# Build du thème Keycloakify puis image Keycloak avec le thème embarqué.
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build-keycloak-theme

FROM quay.io/keycloak/keycloak:26.7.0
COPY --from=builder /app/dist_keycloak/keycloak-theme-*.jar /opt/keycloak/providers/
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
