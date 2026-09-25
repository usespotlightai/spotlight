ARG GO_VERSION=1.26

FROM golang:${GO_VERSION}-bookworm AS build
WORKDIR /src
COPY data-plane/go.mod data-plane/go.sum ./
RUN go mod download
COPY data-plane/ ./
ENV CGO_ENABLED=0
ARG SPOTLIGHT_VERSION=dev
RUN go build -ldflags "-X main.version=${SPOTLIGHT_VERSION}" -o /out/spotlight ./cmd/spotlight

# Not Alpine: cursor-agent ships only a glibc binary.
FROM debian:bookworm-slim AS runner
ARG CLAUDE_CODE_VERSION=latest
ARG CLAUDE_AGENT_ACP_VERSION=latest
ARG CODEX_ACP_VERSION=latest
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git jq curl ca-certificates bash \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 2000 -s /bin/bash agent \
    && install -d -o agent -g agent -m 0700 /workspace
RUN npm install -g \
        "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
        "@agentclientprotocol/claude-agent-acp@${CLAUDE_AGENT_ACP_VERSION}" \
        "@agentclientprotocol/codex-acp@${CODEX_ACP_VERSION}" \
    && npm cache clean --force
RUN mkdir -p /opt/cursor \
    && HOME=/opt/cursor bash -c 'curl https://cursor.com/install -fsS | bash' \
    && ln -sf /opt/cursor/.local/bin/cursor-agent /usr/local/bin/cursor-agent \
    && chmod -R a+rX /opt/cursor
COPY --from=build /out/spotlight /usr/local/bin/
ENV SPOTLIGHT_AGENT_USER=agent \
    SPOTLIGHT_WORKSPACE=/workspace
USER root
ENTRYPOINT ["spotlight", "runner"]

FROM golang:${GO_VERSION}-bookworm AS host-development
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV CGO_ENABLED=0
RUN go install github.com/air-verse/air@latest
WORKDIR /app
COPY data-plane/go.mod data-plane/go.sum ./
RUN go mod download
COPY data-plane/ ./
CMD ["air", "-c", ".air.toml"]
