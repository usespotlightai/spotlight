# control-plane

NestJS API on Postgres (Drizzle), served under `/api`. Setup and configuration:
[root README](../README.md).

`src/` is layered: `domain`, `application`, `infrastructure`, `presentation`.

Dependencies live in a container volume, so run everything inside the service:

```bash
docker compose exec -T control-plane npm install <package>
docker compose exec -T control-plane npm test            # unit
docker compose -f compose.yml -f compose.test.yml up -d   # adds the e2e database
docker compose exec -T control-plane npm run test:e2e
docker compose -f compose.yml -f compose.test.yml --profile pgbouncer up -d   # adds PgBouncer in front of it
docker compose exec -T -e SPOTLIGHT_E2E_POOLER_URL=postgres://postgres:postgres@pgbouncer:6432/postgres control-plane npm run test:e2e   # e2e through PgBouncer, as CI runs it
docker compose exec -T control-plane npm run check       # biome
docker compose exec -T control-plane npm run openapi:generate   # writes openapi.json (web) and openapi.<audience>.json per audience
```
