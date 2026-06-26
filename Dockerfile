# ============================================
# Stage 1: Développement
# ============================================
FROM node:22-alpine AS development

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:dev"]

# ============================================
# Stage 2: Production (build)
# ============================================
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production && npm cache clean --force

COPY --from=development /app/dist ./dist
COPY --from=development /app/node_modules ./node_modules

# ============================================
# Stage 3: Production (runtime)
# ============================================
FROM node:22-alpine AS production

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 3000

USER node

CMD ["node", "dist/main"]
