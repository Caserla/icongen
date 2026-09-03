FROM node:24-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY services/icon-worker/package.json services/icon-worker/package.json
COPY packages/backend-core/package.json packages/backend-core/package.json
COPY packages/icon-skill/package.json packages/icon-skill/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS web-runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S icongen && adduser -S icongen -G icongen
COPY --from=build --chown=icongen:icongen /app/apps/web/.next/standalone ./
COPY --from=build --chown=icongen:icongen /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=icongen:icongen /app/apps/web/public ./apps/web/public
USER icongen
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

FROM node:24-alpine AS worker-runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S icongen && adduser -S icongen -G icongen
COPY --from=build --chown=icongen:icongen /app /app
USER icongen
WORKDIR /app/services/icon-worker
CMD ["npm", "run", "daemon"]
