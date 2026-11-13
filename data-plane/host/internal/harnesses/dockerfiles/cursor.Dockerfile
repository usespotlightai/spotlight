ARG BASE=ghcr.io/usespotlightai/spotlight-runner:latest
FROM ${BASE}
RUN mkdir -p /opt/cursor \
    && HOME=/opt/cursor bash -c 'curl https://cursor.com/install -fsS | bash' \
    && ln -sf /opt/cursor/.local/bin/cursor-agent /usr/local/bin/cursor-agent \
    && chmod -R a+rX /opt/cursor
