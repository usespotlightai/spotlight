FROM cloudflare/cloudflared:latest AS cloudflared

FROM alpine:3.22
COPY --from=cloudflared /usr/local/bin/cloudflared /usr/local/bin/cloudflared
COPY .docker/tunnel/entrypoint /usr/local/bin/entrypoint
ENTRYPOINT [ "/usr/local/bin/entrypoint" ]
