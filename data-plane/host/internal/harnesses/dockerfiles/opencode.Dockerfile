ARG BASE=ghcr.io/usespotlightai/spotlight-runner:latest
FROM ${BASE}
ARG OPENCODE_VERSION=1
RUN npm install -g "opencode-ai@${OPENCODE_VERSION}" \
    && npm cache clean --force
