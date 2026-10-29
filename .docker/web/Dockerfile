# syntax=docker/dockerfile:1
ARG NODE_VERSION=24-alpine
ARG NPM_VERSION=11.19.1
ARG NGINX_VERSION=1.29-alpine

FROM node:${NODE_VERSION} AS deps
ARG NPM_VERSION
RUN npm install -g npm@${NPM_VERSION}
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci

FROM node:${NODE_VERSION} AS build
ARG SPOTLIGHT_VERSION=dev
ARG SENTRY_ORG
ARG SENTRY_PROJECT
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY web/ ./
RUN --mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
    SENTRY_RELEASE="${SPOTLIGHT_VERSION}" npm run build

FROM node:${NODE_VERSION} AS development
ENV NODE_ENV=development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY web/ ./
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM nginx:${NGINX_VERSION} AS runtime
RUN apk upgrade --no-cache
COPY .docker/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
