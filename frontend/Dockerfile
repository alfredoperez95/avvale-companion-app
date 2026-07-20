FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# URL interna del Nest para rewrites server-side `/api/*` (misma red Docker que el backend). Ver `next.config.ts`.
ARG INTERNAL_API_URL
ENV INTERNAL_API_URL=${INTERNAL_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --ingroup nodejs nextjs \
    && rm -f /usr/bin/wget /bin/wget

COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "const http=require('http');const req=http.get({host:'127.0.0.1',port:process.env.PORT||3000,path:'/',timeout:4000},res=>process.exit(res.statusCode<500?0:1));req.on('timeout',()=>req.destroy(new Error('timeout')));req.on('error',()=>process.exit(1));"

CMD ["node", "server.js"]