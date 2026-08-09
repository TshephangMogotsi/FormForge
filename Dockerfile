FROM node:22.18-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci

COPY client ./client
COPY server ./server
RUN npm run build

FROM node:22.18-alpine AS production-dependencies

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22.18-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=production-dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/server/dist ./server/dist

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O - "http://127.0.0.1:${PORT:-4000}/api/health/live" > /dev/null || exit 1

CMD ["node", "server/dist/server.js"]
