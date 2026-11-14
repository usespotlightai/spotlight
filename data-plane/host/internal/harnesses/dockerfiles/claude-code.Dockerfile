ARG BASE=ghcr.io/usespotlightai/spotlight-runner:latest
FROM ${BASE}
ARG CLAUDE_CODE_VERSION=2.1.323
ARG CLAUDE_AGENT_ACP_VERSION=0.107.0
RUN npm install -g \
        "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
        "@agentclientprotocol/claude-agent-acp@${CLAUDE_AGENT_ACP_VERSION}" \
    && npm cache clean --force
