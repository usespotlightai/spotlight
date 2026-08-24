ARG GO_VERSION=1.26

FROM golang:${GO_VERSION}-alpine AS deps
WORKDIR /app

RUN adduser -D -u 2000 agent
RUN apk add --no-cache git jq nodejs npm
RUN npm install -g @anthropic-ai/claude-code
COPY runner/go.mod runner/go.sum ./
RUN go mod download

FROM deps AS development
ENV CGO_ENABLED=0
RUN go install github.com/air-verse/air@latest
COPY .docker/runner/hooks/ /etc/spotlight/hooks/
COPY runner/ ./
CMD ["air", "-c", ".air.toml"]

FROM deps AS build
ENV CGO_ENABLED=0
COPY runner/ ./
RUN go build -o /out/runner ./cmd/runner

FROM alpine:3 AS runtime
RUN apk add --no-cache git jq nodejs npm ca-certificates && adduser -D -u 2000 agent
RUN npm install -g @anthropic-ai/claude-code
COPY .docker/runner/hooks/ /etc/spotlight/hooks/
COPY --from=build /out/runner /usr/local/bin/runner

USER root
ENTRYPOINT ["runner"]
