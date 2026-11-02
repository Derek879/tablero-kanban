# Etapa 1: compilo el frontend
FROM node:22-alpine AS cliente
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Etapa 2: compilo el servidor
FROM node:22-alpine AS servidor
RUN apk add --no-cache python3 make g++
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build && npm prune --omit=dev

# Etapa 3: imagen final solo con lo necesario
FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/kanban.db CLIENT_DIST=/app/client/dist
WORKDIR /app/server
COPY --from=servidor /app/server/node_modules ./node_modules
COPY --from=servidor /app/server/dist ./dist
COPY --from=servidor /app/server/package.json ./
COPY --from=cliente /app/client/dist /app/client/dist
VOLUME /data
EXPOSE 3000
CMD ["node", "dist/server.js"]
