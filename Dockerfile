# Build stage
FROM node:20-bookworm-slim AS build
WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY elastic ./elastic
COPY src ./src
RUN npm run build

COPY streets-ui/package.json streets-ui/package-lock.json streets-ui/
COPY streets-ui/tsconfig*.json streets-ui/index.html streets-ui/vite.config.ts streets-ui/
COPY streets-ui/src streets-ui/src
RUN cd streets-ui && npm ci && npm run build

# Run stage
FROM node:20-bookworm-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /build/dist ./dist
COPY --from=build /build/streets-ui/dist ./streets-ui/dist

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/server.js"]
