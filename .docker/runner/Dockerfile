ARG GO_VERSION=1.26

FROM golang:${GO_VERSION}-alpine AS deps
WORKDIR /app

RUN apk add --no-cache git jq nodejs npm bash
RUN adduser -D -u 2000 -s /bin/bash agent
RUN npm install -g @anthropic-ai/claude-code @zed-industries/claude-agent-acp
COPY runner/go.mod runner/go.sum ./
RUN go mod download

FROM deps AS development
ENV CGO_ENABLED=0
RUN go install github.com/air-verse/air@latest
COPY .docker/runner/hooks/ /etc/spotlight/hooks/
COPY runner/ ./
RUN go build -o /usr/local/bin/spotlight ./cmd/spotlight
CMD ["air", "-c", ".air.toml"]

# Production installs through the same script a host does, not a local build.
FROM alpine:3 AS runtime
ARG SPOTLIGHT_INSTALL_URL=https://dev.usespotlight.ai
RUN apk add --no-cache git jq nodejs npm bash curl ca-certificates \
    && adduser -D -u 2000 -s /bin/bash agent
RUN npm install -g @anthropic-ai/claude-code @zed-industries/claude-agent-acp
COPY .docker/runner/hooks/ /etc/spotlight/hooks/
RUN curl -fsSL "$SPOTLIGHT_INSTALL_URL/api/install.sh" | SPOTLIGHT_BIN_DIR=/usr/local/bin bash

USER root
ENTRYPOINT ["runner"]
