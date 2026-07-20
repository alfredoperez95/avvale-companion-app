FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma exige DATABASE_URL en tiempo de `generate`; no usar .env del host en la imagen.
ENV DATABASE_URL="mysql://build:build@127.0.0.1:3306/build"
RUN npx prisma generate
RUN npm run build

FROM base AS prod-deps
ENV NODE_ENV=production
# Prisma CLI se mantiene como dependencia runtime porque el entrypoint ejecuta migraciones.
COPY package.json package-lock.json* ./
COPY prisma ./prisma
ENV DATABASE_URL="mysql://build:build@127.0.0.1:3306/build"
RUN npm ci --omit=dev && npm cache clean --force

FROM base AS runner
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 app \
    && adduser --system --uid 1001 --ingroup app app \
    && rm -f /usr/bin/wget /bin/wget

COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/package.json ./
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/scripts/entrypoint.sh ./entrypoint.sh

RUN chmod +x entrypoint.sh

USER app

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "const http=require('http');const req=http.get({host:'127.0.0.1',port:process.env.PORT||4000,path:'/health/live',timeout:4000},res=>process.exit(res.statusCode<500?0:1));req.on('timeout',()=>req.destroy(new Error('timeout')));req.on('error',()=>process.exit(1));"

ENTRYPOINT ["./entrypoint.sh"]