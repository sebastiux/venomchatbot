# Multi-stage Dockerfile for Karuna Bot (BuilderBot + Baileys + Grok AI)

# ============= Stage 1: Build =============
FROM node:21-alpine3.18 as builder

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
    && apk add --no-cache git \
    && pnpm install && pnpm run build \
    && apk del .gyp

# ============= Stage 2: Production =============
FROM node:21-alpine3.18 as deploy

WORKDIR /app

ARG PORT
ENV PORT $PORT
EXPOSE $PORT

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/*.json /app/*-lock.yaml ./

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
