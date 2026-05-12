ARG NODE_BASE_IMAGE=node:20-alpine
FROM ${NODE_BASE_IMAGE} AS base
WORKDIR /app
ENV CI=true
ARG PRISMA_ENGINES_MIRROR=https://binaries.prisma.sh
ENV PRISMA_ENGINES_MIRROR=${PRISMA_ENGINES_MIRROR}
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apk/repositories && \
    apk add --no-cache \
  bash \
  openssl \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont \
  font-noto-cjk

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm config set registry https://registry.npmmirror.com && npm ci

FROM deps AS development
ENV NODE_ENV=development
CMD ["sh", "-c", "npm install && npm run db:generate && npm run build --workspace @offer360/shared && npm run start:dev --workspace @offer360/api"]

FROM deps AS builder
ENV PRISMA_QUERY_ENGINE_LIBRARY=/opt/prisma-engines/libquery_engine.so.node
ENV PRISMA_SCHEMA_ENGINE_BINARY=/opt/prisma-engines/schema-engine
COPY .prisma-build/prisma-engines/ /opt/prisma-engines/
RUN chmod +x /opt/prisma-engines/schema-engine
COPY . .
RUN npm run build --workspace @offer360/shared
RUN npm run db:generate
RUN npm run build:api

FROM base AS runner
ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PRISMA_QUERY_ENGINE_LIBRARY=/opt/prisma-engines/libquery_engine.so.node
ENV PRISMA_SCHEMA_ENGINE_BINARY=/opt/prisma-engines/schema-engine
COPY --from=builder /opt/prisma-engines /opt/prisma-engines
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
EXPOSE 4000
CMD ["npm", "run", "start", "--workspace", "@offer360/api"]
