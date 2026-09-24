import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';
import {
  API_VERSION,
  API_VERSION_HEADER,
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENT_REPLAY_HEADER,
  PROBLEM_CONTENT_TYPE,
  RESOURCE_EXTENSION,
} from '@platform/http/resources/resource-headers';
import { EXPRESSIONS, RESOURCES } from '@platform/http/routes';

const RESOURCE_CONVENTIONS = `
HTTP API for the Spotlight Control Plane.

## Resource conventions

Operations marked \`${RESOURCE_EXTENSION}\` manage configuration resources, the ones the Terraform provider writes. They live under \`/${RESOURCES}\` and address everything by id. Every resource follows these rules, and a conformance suite holds each one to them.

- **Stable ids.** Spotlight issues a resource's \`id\` when it is created. It never changes for the resource's life, whatever else does.
- **Reads return every field.** A read answers the whole resource, defaults filled in, so a client comparing it with what it wrote sees any drift. A write answers exactly what a read would.
- **Versions.** Every resource carries a \`version\` that rises with each change, and each answer carries it as a strong \`ETag\` (\`"3"\`). An update or delete must send it back as \`If-Match\`: without one it is refused with 428, and against a version that is no longer current with 409, whose body gives the \`currentVersion\` and whose \`ETag\` names it. A write that would remove something another resource still uses is refused with 409 \`in-use\`.
- **Idempotent creates.** A create must carry an \`${IDEMPOTENCY_KEY_HEADER}\`. Retrying with the same key and body within 24 hours answers the resource the first attempt created, marked \`${IDEMPOTENT_REPLAY_HEADER}: true\`, and creates nothing more; the same key with a different body is refused with 422.
- **Problems name fields.** Errors are \`${PROBLEM_CONTENT_TYPE}\` (RFC 9457). \`type\` is stable and safe to branch on. An invalid request lists \`errors\`, each with the \`path\` of the attribute it is about, as in \`stations[2].check\`; a key that is not a plain name is quoted, as Terraform addresses it: \`on["task.opened"].to.thread\`.
- **API versions.** A client may send \`${API_VERSION_HEADER}\`; every response names the version it was answered in, currently \`${API_VERSION}\`. Changes within a version are additive only: fields and operations are added, never removed, renamed or given a new meaning.
- **Expression checks.** \`POST /${EXPRESSIONS}/check\` type-checks one CEL expression at the attribute that holds it, named within the resource's whole definition (\`integration.webhook.events[0].when\`), as \`terraform plan\` needs. What the expression may read is worked out from that definition exactly as applying it would, so a plan fails where an apply would; a definition holding any error is refused with 422, each error under \`definition\`. It answers the type and any errors, each with the span it is about and a suggestion where a declared name is near, and warnings about the definition, such as a capture shadowing a built-in name. \`GET /${EXPRESSIONS}/positions\` lists every position, with \`[*]\` for any index or key, and what an expression there sees. They follow these headers and problems, but are not resources.
- **Import by address.** Each resource has an \`address\` that names it within its workspace, such as \`core/linear\`, and an import operation that answers the resource at that address, as \`terraform import\` needs. A workspace's address is its slug; a team's is its key; anything a team holds is the team's key and its own, as in \`core/delivery\`.
`.trim();

const openApiConfig = new DocumentBuilder()
  .setTitle('Spotlight Control Plane')
  .setDescription(RESOURCE_CONVENTIONS)
  .setVersion(API_VERSION)
  .addServer('/api')
  .build();

export const buildOpenApiDocument = (app: INestApplication): OpenAPIObject =>
  SwaggerModule.createDocument(app, openApiConfig);
