ARG GO_VERSION=1.26

FROM golang:${GO_VERSION}-alpine AS deps
WORKDIR /app

RUN apk add --no-cache git jq nodejs npm bash
RUN adduser -D -u 2000 -s /bin/bash agent
RUN npm install -g @anthropic-ai/claude-code

# A first-run installation asks about a theme, about running without approving
# each command, and the rest of it -- at a terminal, waiting. An agent has no
# view on any of that, so the answers are given here. What is left is the
# account it signs in as, which is a person's to give.
RUN printf '%s' '{"hasCompletedOnboarding":true,"theme":"dark","bypassPermissionsModeAccepted":true}' \
      >/home/agent/.claude.json \
 && chown agent:agent /home/agent/.claude.json
COPY runner/go.mod runner/go.sum ./
RUN go mod download

FROM deps AS development
ENV CGO_ENABLED=0
RUN go install github.com/air-verse/air@latest
COPY .docker/runner/hooks/ /etc/spotlight/hooks/
COPY runner/ ./
RUN go build -o /usr/local/bin/spotlight ./cmd/spotlight
CMD ["air", "-c", ".air.toml"]

FROM deps AS build
ENV CGO_ENABLED=0
COPY runner/ ./
RUN go build -o /out/runner ./cmd/runner
RUN go build -o /out/spotlight ./cmd/spotlight

FROM alpine:3 AS runtime
RUN apk add --no-cache git jq nodejs npm bash ca-certificates \
    && adduser -D -u 2000 -s /bin/bash agent
RUN npm install -g @anthropic-ai/claude-code

# A first-run installation asks about a theme, about running without approving
# each command, and the rest of it -- at a terminal, waiting. An agent has no
# view on any of that, so the answers are given here. What is left is the
# account it signs in as, which is a person's to give.
RUN printf '%s' '{"hasCompletedOnboarding":true,"theme":"dark","bypassPermissionsModeAccepted":true}' \
      >/home/agent/.claude.json \
 && chown agent:agent /home/agent/.claude.json
COPY .docker/runner/hooks/ /etc/spotlight/hooks/
COPY --from=build /out/runner /usr/local/bin/runner
COPY --from=build /out/spotlight /usr/local/bin/spotlight

USER root
ENTRYPOINT ["runner"]
