ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY control-plane/package.json control-plane/package-lock.json ./
RUN npm ci

FROM node:${NODE_VERSION} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY control-plane/ ./
RUN npm run build

FROM node:${NODE_VERSION} AS development
ENV NODE_ENV=development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY control-plane/ ./
EXPOSE 3000 9229
CMD ["npm", "run", "start:dev"]

FROM node:${NODE_VERSION} AS prod-deps
WORKDIR /app
COPY control-plane/package.json control-plane/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY control-plane/package.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
