# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json /app/
COPY package-lock.json* pnpm-lock.yaml* yarn.lock* /app/

RUN \
  if [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm i --frozen-lockfile; \
  elif [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  else npm i; fi

# ---- build ----
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG DEV_BYPASS_AUTH
    ARG AUTH_COOKIE_SECURE
    ARG AUTH_COOKIE_NAME
    ARG AUTH_JWT_SECRET

    ENV DEV_BYPASS_AUTH=${DEV_BYPASS_AUTH}
    ENV AUTH_COOKIE_SECURE=${AUTH_COOKIE_SECURE}
    ENV AUTH_COOKIE_NAME=${AUTH_COOKIE_NAME}
    ENV AUTH_JWT_SECRET=${AUTH_JWT_SECRET}

    RUN npm run build

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache libc6-compat

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/app ./app

EXPOSE 3000

CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
