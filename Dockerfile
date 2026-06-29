# ============================================
# Stage 1: Développement
# ============================================
FROM node:22-alpine AS development

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .

RUN pnpm run build

EXPOSE 3000

CMD ["pnpm", "run", "start:dev"]

# ============================================
# Stage 2: Production (build)
# ============================================
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --prod

COPY --from=development /app/dist ./dist

# ============================================
# Stage 3: Production (runtime)
# ============================================
FROM node:22-alpine AS production

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

EXPOSE 3000

USER node

CMD ["node", "dist/main"]
