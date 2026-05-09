FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl chromium nss freetype harfbuzz ca-certificates ttf-freefont font-noto-cjk
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm config set registry https://registry.npmmirror.com && npm install

FROM deps AS builder
WORKDIR /app
COPY . .
RUN npm run build --workspace @offer360/shared
RUN npm run db:generate && npm run build:api

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl chromium nss freetype harfbuzz ca-certificates ttf-freefont font-noto-cjk
ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/packages/shared ./packages/shared
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/src/main.js"]
