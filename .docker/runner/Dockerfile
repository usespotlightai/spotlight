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

FROM alpine:3 AS runtime
ARG SPOTLIGHT_VERSION=latest
RUN apk add --no-cache git jq nodejs npm bash curl ca-certificates \
    && adduser -D -u 2000 -s /bin/bash agent
COPY .docker/runner/hooks/ /etc/spotlight/hooks/
COPY installer/install.sh /tmp/install.sh
RUN SPOTLIGHT_BIN_DIR=/usr/local/bin SPOTLIGHT_VERSION="$SPOTLIGHT_VERSION" \
    SPOTLIGHT_CONFIG=/dev/null sh /tmp/install.sh \
    && rm /tmp/install.sh

USER root
ENTRYPOINT ["runner"]
