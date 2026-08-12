# Build du thème Keycloakify (v11) puis image Keycloak avec le thème embarqué.
# Le JAR du thème est produit par keycloakify via Maven (build_keycloak/target/).
FROM node:22-bookworm AS builder
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends maven openjdk-17-jdk-headless \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10 --no-audit --no-fund
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build-keycloak-theme

FROM quay.io/keycloak/keycloak:26.7.0
# JAR ciblé Keycloak 26+ (login uniquement) : évite les conflits de thèmes multi-versions.
COPY --from=builder /app/dist_keycloak/keycloak-theme-for-kc-all-other-versions.jar /opt/keycloak/providers/
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
