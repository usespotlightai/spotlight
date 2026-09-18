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
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY web/ ./
RUN npm run build

FROM node:${NODE_VERSION} AS development
ENV NODE_ENV=development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY web/ ./
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM nginx:${NGINX_VERSION} AS runtime
COPY .docker/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
