import { randomUUID } from 'node:crypto';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { PETSTORE } from '@integrations/infrastructure/sources/openapi/petstore.fake-spec';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { BoundTaskDto } from '@work/application/dto/bound-task.dto';
import { ToolDeclarationMapper } from '@work/application/mappers/tool-declaration.mapper';
import { toolManifestOf } from '@work/application/mappers/tool-manifest.mapper';
import {
  INTEGRATION_TOOL_CALLS,
  type IntegrationTool,
  type IntegrationToolCallsPort,
} from '@work/application/ports/integration-tool-calls.port';
import {
  TEAM_INTEGRATIONS,
  type TeamIntegrationsPort,
} from '@work/application/ports/team-integrations.port';
import { eq, inArray } from 'drizzle-orm';
import { buildSchema, graphql } from 'graphql';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const LINEAR_SDL = `
type Issue { id: ID! title: String! }
input IssueCreateInput { title: String! teamId: String! }
type IssuePayload { success: Boolean! issue: Issue }
type Query { issue(id: String!): Issue }
type Mutation { issueCreate(input: IssueCreateInput!): IssuePayload! }
`;

const LINEAR_SCHEMA = buildSchema(LINEAR_SDL);

interface Heard {
  readonly method: string;
  readonly url: string;
  readonly body: string;
  readonly authorization: string | undefined;
}

const fixture = () => {
  const heard: Heard[] = [];
  const answer = (reply: ServerResponse, status: number, body: unknown) => {
    reply.writeHead(status, { 'content-type': 'application/json' });
    reply.end(JSON.stringify(body));
  };

  const server: Server = createServer(
    (request: IncomingMessage, reply: ServerResponse) => {
      const chunks: Buffer[] = [];

      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', async () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const url = request.url ?? '/';

        heard.push({
          method: request.method ?? 'GET',
          url,
          body,
          authorization: request.headers.authorization,
        });

        if (url.startsWith('/api/v3/openapi.json')) {
          return answer(reply, 200, PETSTORE);
        }

        if (url.startsWith('/api/v3/pet/findByStatus')) {
          return answer(reply, 200, [
            { id: 10, name: 'doggie', status: 'sold' },
          ]);
        }

        if (url === '/api/v3/pet' && request.method === 'POST') {
          return answer(reply, 200, { id: 11, ...JSON.parse(body) });
        }

        if (url === '/graphql' && request.method === 'POST') {
          const asked = JSON.parse(body) as {
            query: string;
            variables?: Record<string, unknown>;
          };

          return answer(
            reply,
            200,
            await graphql({
              schema: LINEAR_SCHEMA,
              source: asked.query,
              variableValues: asked.variables ?? {},
              rootValue: {
                issue: ({ id }: { id: string }) => ({ id, title: 'Broken' }),
              },
            }),
          );
        }

        return answer(reply, 404, { message: 'nothing here' });
      });
    },
  );

  return {
    heard,
    server,
    hits: (path: string) =>
      heard.filter((each) => each.url.startsWith(path)).length,
  };
};

describe('an integration offering tools from an API description (e2e)', () => {
  const upstream = fixture();
  let app: INestApplication;
  let db: DrizzleDatabase;
  let origin: string;
  let held: string;
  let seat: Awaited<ReturnType<typeof seatTeam>>;
  const hashes: string[] = [];

  const petstore = (over: Record<string, unknown> = {}) => ({
    integration: 'petstore',
    name: 'Petstore',
    openapi: {
      url: `${origin}/api/v3/openapi.json`,
      tools: { exclude: ['update-pet'] },
      ...over,
    },
  });

  const create = (body: object, key: string = randomUUID()) =>
    served(app)
      .post(`/api/resources/teams/${held}/integrations`)
      .set(TEST_USER_HEADER, seat.owner)
      .set('Idempotency-Key', key)
      .send(body);

  const update = (id: string, version: number, body: object) =>
    served(app)
      .put(`/api/resources/integrations/${id}`)
      .set(TEST_USER_HEADER, seat.owner)
      .set('If-Match', `"${version}"`)
      .send(body);

  const task = (): BoundTaskDto => ({
    taskId: 'task_1',
    workspaceId: held,
    teamId: held,
    line: 'delivery',
    station: 'Implementation',
    stationKey: 'implementation',
    marks: {},
    waiting: null,
  });

  const reach = async (tool: string) =>
    (await app
      .get<IntegrationToolCallsPort>(INTEGRATION_TOOL_CALLS)
      .reach(
        tool,
        task(),
        { runId: 'run_1', attempt: 1 },
        null,
      )) as IntegrationTool;

  beforeAll(async () => {
    await new Promise<void>((resolve) =>
      upstream.server.listen(0, '127.0.0.1', resolve),
    );
    origin = `http://127.0.0.1:${(upstream.server.address() as AddressInfo).port}`;
    vi.stubEnv('OUTBOUND_ALLOWED_HOSTS', new URL(origin).host);
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
    await new Promise((resolve) => upstream.server.close(resolve));
    vi.unstubAllEnvs();
  });

  beforeEach(async () => {
    held = `sources-${randomUUID().slice(0, 8)}`;
    seat = await seatTeam(db, held);
    upstream.heard.length = 0;
  });

  afterEach(async () => {
    await db
      .delete(schema.idempotentCreate)
      .where(inArray(schema.idempotentCreate.scope, [`person:${seat.owner}`]));
    await db
      .delete(schema.integrationDefinition)
      .where(eq(schema.integrationDefinition.teamId, held));
    await db
      .delete(schema.configurationChange)
      .where(eq(schema.configurationChange.workspaceId, held));
    if (hashes.length > 0) {
      await db
        .delete(schema.describedDocument)
        .where(inArray(schema.describedDocument.hash, hashes.splice(0)));
    }
    await seat.unseat();
  });

  it('offers each operation of the description it reads as a tool', async () => {
    const made = await create(petstore());

    expect(made.status).toBe(201);
    hashes.push(made.body.described.hash);
    expect(made.body.tools).toEqual({
      'add-pet': 'petstore.add-pet',
      'find-pets-by-status': 'petstore.find-pets-by-status',
      'find-pets-by-tags': 'petstore.find-pets-by-tags',
      'get-pet-by-id': 'petstore.get-pet-by-id',
      'delete-pet': 'petstore.delete-pet',
      'get-store-inventory': 'petstore.get-store-inventory',
    });
    expect(made.body.described).toMatchObject({
      kind: 'openapi',
      hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      problem: null,
      tools: 6,
    });
    expect(made.body.warnings).toEqual([
      expect.objectContaining({
        path: 'openapi',
        message: expect.stringMatching(/^passes over uploadFile/),
      }),
    ]);
  });

  it('reads the description again only when where it is read from changes', async () => {
    const made = await create(petstore());
    hashes.push(made.body.described.hash);

    expect(upstream.hits('/api/v3/openapi.json')).toBe(1);

    const renamed = await update(made.body.id, made.body.version, {
      ...petstore(),
      name: 'Pets',
    });

    expect(renamed.status).toBe(200);
    expect(upstream.hits('/api/v3/openapi.json')).toBe(1);

    await reach('petstore.find-pets-by-status');

    expect(upstream.hits('/api/v3/openapi.json')).toBe(1);

    const revised = await update(
      made.body.id,
      renamed.body.version,
      petstore({ revision: '2' }),
    );

    expect(revised.status).toBe(200);
    expect(upstream.hits('/api/v3/openapi.json')).toBe(2);

    const moved = await update(
      made.body.id,
      revised.body.version,
      petstore({ url: `${origin}/api/v3/openapi.json?moved=1` }),
    );

    expect(moved.status).toBe(200);
    expect(upstream.hits('/api/v3/openapi.json')).toBe(3);
  });

  it('answers a retried create from what it created, without reading the description again', async () => {
    const key = randomUUID();
    const made = await create(petstore(), key);
    const retried = await create(petstore(), key);

    expect(retried.status).toBe(201);
    expect(retried.headers['idempotent-replayed']).toBe('true');
    expect(retried.body.id).toBe(made.body.id);
    expect(upstream.hits('/api/v3/openapi.json')).toBe(1);

    const reused = await create(petstore({ revision: '2' }), key);

    expect(reused.status).toBe(422);
    expect(reused.body.type).toMatch(/idempotency-key-reused$/);
    expect(upstream.hits('/api/v3/openapi.json')).toBe(1);
  });

  it('calls a generated tool end to end, and refuses input not of its shape before calling anything', async () => {
    const made = await create(petstore());
    hashes.push(made.body.described.hash);
    upstream.heard.length = 0;

    const finding = await reach('petstore.find-pets-by-status');

    await expect(finding.call({ status: 'sold' })).resolves.toEqual([
      { id: 10, name: 'doggie', status: 'sold' },
    ]);
    expect(upstream.heard.map((each) => `${each.method} ${each.url}`)).toEqual([
      'GET /api/v3/pet/findByStatus?status=sold',
    ]);

    const adding = await reach('petstore.add-pet');
    const declared = ToolDeclarationMapper.toDeclared(adding.declared);

    expect(declared.approval?.because).toBe('It changes data in Petstore.');
    expect(() => declared.accept({ body: { photoUrls: 'one.png' } })).toThrow(
      'petstore.add-pet takes body, and {"photoUrls":"one.png"} needs name',
    );
    expect(upstream.hits('/api/v3/pet')).toBe(1);

    const accepted = declared.accept({
      body: '{"name": "rex", "photoUrls": []}',
    });

    await expect(adding.call(accepted.values)).resolves.toEqual({
      id: 11,
      name: 'rex',
      photoUrls: [],
    });
  });

  it('hands a run the schema of what a generated tool takes', async () => {
    const made = await create(petstore());
    hashes.push(made.body.described.hash);

    const [offered] = await app
      .get<TeamIntegrationsPort>(TEAM_INTEGRATIONS)
      .offered(TeamId.of(held), ['petstore.find-pets-by-tags']);
    const manifest = toolManifestOf(
      ToolDeclarationMapper.toDeclared(offered ?? never()),
    );

    expect(manifest.inputs).toEqual([
      {
        name: 'tags',
        schema: { type: 'array', items: { type: 'string' } },
        required: false,
        defaulted: false,
        piped: false,
      },
    ]);
  });

  it('keeps an integration whose description could not be read, saying why', async () => {
    const made = await create(petstore({ url: `${origin}/missing.json` }));

    expect(made.status).toBe(201);
    expect(made.body.tools).toEqual({});
    expect(made.body.described).toMatchObject({
      kind: 'openapi',
      hash: null,
      problem: `could not be read: ${new URL(origin).host} answered 404`,
      tools: 0,
    });
    expect(made.body.warnings).toEqual([
      expect.objectContaining({ path: 'openapi.url' }),
    ]);
  });

  it('refuses a description on a host the deployment does not allow, without asking it', async () => {
    const made = await create(
      petstore({ url: 'http://169.254.169.254/latest/meta-data' }),
    );

    expect(made.status).toBe(201);
    expect(made.body.described.problem).toMatch(/not on the allowed list/);
  });

  it('offers one tool per GraphQL query and mutation, the mutations needing approval', async () => {
    const made = await create({
      integration: 'linear',
      name: 'Linear',
      graphql: { url: `${origin}/graphql` },
    });

    expect(made.status).toBe(201);
    hashes.push(made.body.described.hash);
    expect(made.body.tools).toEqual({
      issue: 'linear.issue',
      'issue-create': 'linear.issue-create',
    });

    const offered = await app
      .get<TeamIntegrationsPort>(TEAM_INTEGRATIONS)
      .offered(TeamId.of(held), ['linear.issue', 'linear.issue-create']);

    expect(offered.map((each) => each.approval)).toEqual([
      null,
      { because: 'It changes data in Linear.' },
    ]);

    const issue = await reach('linear.issue');

    await expect(issue.call({ id: 'i1' })).resolves.toEqual({
      id: 'i1',
      title: 'Broken',
    });
  });
});

const never = (): never => {
  throw new Error('the team’s integrations offered nothing');
};
