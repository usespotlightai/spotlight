ARG BASE=ghcr.io/usespotlightai/spotlight-runner:latest
FROM ${BASE}
ARG CLAUDE_CODE_VERSION=latest
ARG CLAUDE_AGENT_ACP_VERSION=latest
RUN npm install -g \
        "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
        "@agentclientprotocol/claude-agent-acp@${CLAUDE_AGENT_ACP_VERSION}" \
    && npm cache clean --force
