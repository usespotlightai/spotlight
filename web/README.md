# web

React SPA (Vite), served at https://app.dev.usespotlight.ai. Setup:
[root README](../README.md).

Dependencies live in a container volume, so run everything inside the service:

```bash
docker compose exec -T web npm install <package>
docker compose exec -T web npm test
docker compose exec -T web npm run check           # biome
docker compose exec -T web npm run api:generate    # client in src/lib/api from control-plane/openapi.json
docker compose exec -T web npm run icons           # assets/icons → src/components/common/icons
```
