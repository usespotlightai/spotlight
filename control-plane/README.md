# control-plane

NestJS API on Postgres (Drizzle), served under `/api`. Setup and configuration:
[root README](../README.md).

`src/` is layered: `domain`, `application`, `infrastructure`, `presentation`.

Dependencies live in a container volume, so run everything inside the service:

```bash
docker compose exec -T control-plane npm install <package>
docker compose exec -T control-plane npm test            # unit
docker compose exec -T control-plane npm run test:e2e
docker compose exec -T control-plane npm run check       # biome
docker compose exec -T control-plane npm run openapi:generate   # writes openapi.json for web
```
