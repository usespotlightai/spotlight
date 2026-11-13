ARG BASE=ghcr.io/usespotlightai/spotlight-runner:latest
FROM ${BASE}
ARG CODEX_ACP_VERSION=latest
RUN npm install -g "@agentclientprotocol/codex-acp@${CODEX_ACP_VERSION}" \
    && npm cache clean --force
