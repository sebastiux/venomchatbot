# Multi-stage Dockerfile for Karuna Bot (BuilderBot + Baileys + Grok AI)

# ============= Stage 1: Build Frontend =============
FROM node:21-alpine3.18 AS frontend

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
ENV VITE_API_URL=
RUN npm run build

# ============= Stage 2: Build Backend =============
FROM node:21-alpine3.18 AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

COPY package*.json *-lock.yaml ./
COPY tsconfig.json ./
COPY src/ ./src/

RUN apk add --no-cache --virtual .gyp \
        python3 \
        make \
        g++ \
        git \
    && pnpm install && pnpm run build \
    && apk del .gyp

# ============= Stage 3: Production =============
FROM node:21-alpine3.18 AS deploy

WORKDIR /app

ARG PORT
ENV PORT=$PORT
EXPOSE $PORT

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/*.json /app/*-lock.yaml ./
COPY --from=frontend /app/frontend/dist ./public

# Copy config directory if it exists
COPY config/ ./config/

RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/usr/local/bin

RUN npm cache clean --force && pnpm install --production --ignore-scripts \
    && addgroup -g 1001 -S nodejs && adduser -S -u 1001 nodejs \
    && mkdir -p /app/config /app/bot_sessions && chown -R nodejs:nodejs /app \
    && rm -rf $PNPM_HOME/.npm $PNPM_HOME/.node-gyp

USER nodejs

CMD ["npm", "start"]
