ARG NODE_BASE_IMAGE=node:20-alpine
FROM ${NODE_BASE_IMAGE} AS base
WORKDIR /app
ENV CI=true

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm config set registry https://registry.npmmirror.com && npm ci

FROM deps AS development
ENV NODE_ENV=development
CMD ["sh", "-c", "npm install && npm run build --workspace @offer360/shared && npm run dev --workspace @offer360/web -- --hostname 0.0.0.0 --port 3000"]

FROM deps AS builder
COPY . .
RUN npm run build --workspace @offer360/shared
RUN npm run build:web

FROM ${NODE_BASE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
