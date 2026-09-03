FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY services/icon-worker/package.json services/icon-worker/package.json
COPY packages/backend-core/package.json packages/backend-core/package.json
COPY packages/icon-skill/package.json packages/icon-skill/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S icongen && adduser -S icongen -G icongen
COPY --from=build --chown=icongen:icongen /app /app
USER icongen
EXPOSE 3000
CMD ["npm", "run", "start"]
