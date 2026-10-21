FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server.js ./
COPY --chown=node:node server/*.cjs ./server/
COPY --chown=node:node scripts/budget-guard.cjs ./scripts/budget-guard.cjs
USER node
EXPOSE 3000
CMD ["node", "server.js"]
