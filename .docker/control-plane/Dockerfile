ARG NODE_VERSION=24-alpine
ARG NPM_VERSION=11.19.1

FROM node:${NODE_VERSION} AS deps
ARG NPM_VERSION
RUN npm install -g npm@${NPM_VERSION}
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
COPY installer/install.sh /opt/spotlight/installer/install.sh
EXPOSE 3000 9229
CMD ["npm", "run", "start:dev"]

FROM node:${NODE_VERSION} AS migrate
ENV NODE_ENV=development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY control-plane/ ./
CMD ["npm", "run", "db:migrate"]

FROM node:${NODE_VERSION} AS prod-deps
ARG NPM_VERSION
RUN npm install -g npm@${NPM_VERSION}
WORKDIR /app
COPY control-plane/package.json control-plane/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY control-plane/package.json ./
COPY installer/install.sh /opt/spotlight/installer/install.sh
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
