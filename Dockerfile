# ─── Estágio 1: Build ─────────────────────────────────────────
FROM node:22-alpine AS builder

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copia arquivos de dependência
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

# Copia código fonte
COPY packages/shared/ ./packages/shared/
COPY packages/api/ ./packages/api/
COPY apps/web/ ./apps/web/

# Build de todos os pacotes
RUN pnpm build

# Gera deployment standalone da API (node_modules plano + dist)
RUN pnpm deploy --legacy --filter @evobuddy/api /app/api-deploy

# ─── Gera deployment standalone do web (SPA estática)
RUN mkdir -p /app/web-deploy && cp -r apps/web/dist /app/web-deploy/dist

# ─── Estágio 2: API (Express) ─────────────────────────────────
FROM node:22-alpine AS api

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=builder /app/api-deploy ./

EXPOSE 3001
CMD ["node", "dist/index.js"]

# ─── Estágio 3: Web (SPA para servir via nginx) ──────────────
FROM nginx:alpine AS web

COPY --from=builder /app/web-deploy/dist /usr/share/nginx/html
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
