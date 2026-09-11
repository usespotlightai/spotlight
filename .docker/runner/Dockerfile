ARG GO_VERSION=1.26

# Debian (glibc) rather than Alpine (musl): the cursor-agent CLI ships a
# glibc-built binary that will not relocate against musl, and there is no musl
# build of it. Claude Code, Node and the Go toolchain are all happy here too.
FROM golang:${GO_VERSION}-bookworm AS deps
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git jq curl ca-certificates bash \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*
RUN useradd -m -u 2000 -s /bin/bash agent
RUN npm install -g @anthropic-ai/claude-code @zed-industries/claude-agent-acp
# Cursor CLI ships as a binary from its own installer, not npm. Install it into
# a world-readable prefix and link it onto the PATH, so the agent account the
# harness runs as finds `cursor-agent` the same way it finds claude-agent-acp.
RUN mkdir -p /opt/cursor \
    && HOME=/opt/cursor bash -c 'curl https://cursor.com/install -fsS | bash' \
    && ln -sf /opt/cursor/.local/bin/cursor-agent /usr/local/bin/cursor-agent \
    && chmod -R a+rX /opt/cursor
COPY runner/go.mod runner/go.sum ./
RUN go mod download

FROM deps AS development
ENV CGO_ENABLED=0
RUN go install github.com/air-verse/air@latest
COPY .docker/runner/hooks/ /etc/spotlight/hooks/
COPY runner/ ./
RUN go build -o /usr/local/bin/spotlight ./cmd/spotlight
CMD ["air", "-c", ".air.toml"]

FROM debian:bookworm-slim AS runtime
ARG SPOTLIGHT_VERSION=latest
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git jq curl ca-certificates bash \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 2000 -s /bin/bash agent
# Cursor CLI ships as a binary from its own installer, not npm. Install it into
# a world-readable prefix and link it onto the PATH, so the agent account the
# harness runs as finds `cursor-agent` the same way it finds claude-agent-acp.
RUN mkdir -p /opt/cursor \
    && HOME=/opt/cursor bash -c 'curl https://cursor.com/install -fsS | bash' \
    && ln -sf /opt/cursor/.local/bin/cursor-agent /usr/local/bin/cursor-agent \
    && chmod -R a+rX /opt/cursor
COPY .docker/runner/hooks/ /etc/spotlight/hooks/
COPY installer/install.sh /tmp/install.sh
RUN SPOTLIGHT_BIN_DIR=/usr/local/bin SPOTLIGHT_VERSION="$SPOTLIGHT_VERSION" \
    SPOTLIGHT_CONFIG=/dev/null sh /tmp/install.sh \
    && rm /tmp/install.sh

USER root
ENTRYPOINT ["runner"]
