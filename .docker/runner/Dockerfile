ARG GO_VERSION=1.26

FROM --platform=$BUILDPLATFORM golang:${GO_VERSION}-bookworm AS build
WORKDIR /src
COPY data-plane/go.mod data-plane/go.sum ./
RUN go mod download
COPY data-plane/ ./
ENV CGO_ENABLED=0
ARG TARGETOS TARGETARCH
ARG SPOTLIGHT_VERSION=dev
RUN --mount=type=cache,target=/root/.cache/go-build \
    GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -ldflags "-X main.version=${SPOTLIGHT_VERSION}" -o /out/spotlight ./cmd/spotlight

# Do not use Alpine. The cursor-agent package that teams install has only a glibc binary.
FROM debian:bookworm-slim AS runner
ARG TERRAFORM_VERSION=1.16.4
ARG TARGETARCH
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git jq curl ca-certificates bash unzip \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 2000 -s /bin/bash agent \
    && install -d -o agent -g agent -m 0700 /workspace
RUN arch="${TARGETARCH:-$(dpkg --print-architecture)}" \
    && zip="terraform_${TERRAFORM_VERSION}_linux_${arch}.zip" \
    && cd /tmp \
    && curl -fsSLO "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/${zip}" \
    && curl -fsSL "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_SHA256SUMS" \
        | grep " ${zip}$" | sha256sum -c - \
    && unzip -q "${zip}" terraform -d /usr/local/bin \
    && rm "${zip}" \
    && terraform version
COPY --from=build /out/spotlight /usr/local/bin/
ENV SPOTLIGHT_AGENT_USER=agent \
    SPOTLIGHT_WORKSPACE=/workspace \
    CHECKPOINT_DISABLE=1
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
