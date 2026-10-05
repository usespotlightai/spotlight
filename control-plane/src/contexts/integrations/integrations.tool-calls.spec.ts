import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { OAuth2ClientsPort } from '@integrations/application/ports/oauth2-clients.port';
import { DescribedDocument } from '@integrations/domain/aggregates/described-document.aggregate';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import { DescribedOperation } from '@integrations/domain/value-objects/described-operation.vo';
import { IntegrationToolCalls } from '@integrations/infrastructure/acl/integration-tool-calls.adapter';
import { CompiledIntegrationRuntime } from '@integrations/infrastructure/integrations/compiled-integration.runtime';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import {
  HttpOutbound,
  type OutboundResult,
} from '@integrations/infrastructure/outbound/http-outbound';
import { clientsFrom } from '@integrations/integrations.clients.fake-spec';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { operationsHolding } from '@integrations/integrations.documents.fake-spec';
import {
  discoveringNothing,
  reachingNoServer,
} from '@integrations/integrations.mcp.fake-spec';
import {
  injecting,
  reachFor,
} from '@integrations/integrations.secrets.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';
import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
import type { ToolInputValues } from '@work/application/contracts/tools.contract';
import type { BoundTaskDto } from '@work/application/dto/bound-task.dto';
import type {
  IntegrationTool,
  RunAttemptDto,
} from '@work/application/ports/integration-tool-calls.port';
import { describe, expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';

const expressions = new CelExpressionEngine();

const ATTEMPT: RunAttemptDto = { runId: 'run_1', attempt: 2 };

const runtimeWith = (
  outbound: unknown,
  exchange: unknown = {},
  clients: OAuth2ClientsPort = clientsFrom(),
) =>
  new CompiledIntegrationRuntime(
    new IntegrationReader(expressions, operationsHolding()),
    outbound as HttpOutbound,
    clients,
    exchange as OAuth2Exchange,
    discoveringNothing(),
    reachingNoServer(),
  );

const LINEAR = `integration: linear
actions:
  comment:
    request:
      method: POST
      url: https://api.linear.app/graphql
      body:
        issue: '\${{ inputs.issue }}'
        body: '\${{ inputs.body }}'
        count: '\${{ has(inputs.count) ? inputs.count : 0 }}'
      capture:
        url: '\${{ response.url }}'
tools:
  comment:
    does: comment
    description: Comment on the Linear issue this task came from.
    inputs:
      issue:
        default: '\${{ task.marks["linear.issue"] }}'
        required: true
      body:
        required: true
        piped: true
      count:
        type: number
    output: '\${{ capture.url }}'
`;

const task = (marked = true): BoundTaskDto => ({
  taskId: 'task_1',
  workspaceId: 'ws_1',
  teamId: 'team_1',
  line: 'delivery',
  station: 'Implementation',
  stationKey: 'implementation',
  marks: marked ? { 'linear.issue': 'ENG-12' } : {},
  waiting: null,
});

const using = (
  reply: OutboundResult = {
    ok: true,
    status: 200,
    response: { url: 'https://linear.app/acme/issue/ENG-12#comment-1' },
    capture: { url: 'https://linear.app/acme/issue/ENG-12#comment-1' },
  },
  over: { file?: string } = {},
) => {
  const run = vi.fn(
    async (_action: unknown, _against: Record<string, unknown>) => reply,
  );

  const tools = new IntegrationToolCalls(
    {
      ofTeam: vi.fn(async () => [defined(over.file ?? LINEAR)]),
    } as unknown as DefinedIntegrationsPort,
    runtimeWith({ run } as unknown as HttpOutbound),
    reachFor(),
  );

  const reaching = (tool: string, marked = true) =>
    tools.reach(tool, task(marked), ATTEMPT, null);

  const comment = async (inputs: ToolInputValues, marked = true) => {
    const reached = (await reaching(
      'linear.comment',
      marked,
    )) as IntegrationTool;

    return reached.call(inputs);
  };

  return { reaching, run, comment };
};

const usingApproved = () =>
  using(undefined, {
    file: LINEAR.replace(
      '    does: comment\n',
      '    does: comment\n    approval:\n      because: It posts publicly, under the team’s name.\n',
    ),
  });

describe('IntegrationToolCalls', () => {
  it('reaches a tool the team’s integrations declare, as they declare it', async () => {
    const reached = await using().reaching('linear.comment');

    expect(reached?.declared.tool).toBe('linear.comment');
    expect(reached?.declared.inputs.map((each) => each.name)).toEqual([
      'issue',
      'body',
      'count',
    ]);
  });

  it('carries no approval where the file asks for none', async () => {
    const reached = await using().reaching('linear.comment');

    expect(reached?.declared.approval).toBeNull();
  });

  it('carries into Work the approval a tool may only be used with', async () => {
    const reached = await usingApproved().reaching('linear.comment');

    expect(reached?.declared.approval).toEqual({
      because: 'It posts publicly, under the team’s name.',
    });
  });

  it('makes the call the tool’s action describes, and answers with its output', async () => {
    const { comment, run } = using();

    await expect(
      comment({
        issue: 'ENG-7',
        body: 'Fixed in the queue worker.',
        count: 2,
      }),
    ).resolves.toBe('https://linear.app/acme/issue/ENG-12#comment-1');

    const [, against] = run.mock.calls[0] as unknown as [
      unknown,
      Record<string, unknown>,
    ];
    expect(against).toMatchObject({
      task: {
        line: 'delivery',
        station: 'Implementation',
        stationKey: 'implementation',
        marks: { 'linear.issue': 'ENG-12' },
      },
      inputs: { issue: 'ENG-7', body: 'Fixed in the queue worker.', count: 2 },
    });
  });

  describe('an action that wears a secret', () => {
    const WEARS_A_SECRET = LINEAR.replace(
      '      url: https://api.linear.app/graphql\n',
      '      url: https://api.linear.app/graphql\n      auth:\n        secrets: [secret.LINEAR_API_KEY]\n',
    );

    const wearing = (
      bound: Parameters<typeof injecting>[0],
      allowed: readonly string[] = ['api.linear.app'],
    ) => {
      const fetch = vi.fn(
        async () =>
          new Response(JSON.stringify({ url: 'https://linear.app/c/1' }), {
            status: 200,
          }),
      );
      const secrets = injecting(bound);
      const tools = new IntegrationToolCalls(
        {
          ofTeam: vi.fn(async () => [defined(WEARS_A_SECRET)]),
        } as unknown as DefinedIntegrationsPort,
        runtimeWith(new HttpOutbound(allowed, fetch)),
        reachFor(secrets.injection),
      );

      const comment = async () => {
        const reached = (await tools.reach(
          'linear.comment',
          task(),
          ATTEMPT,
          null,
        )) as IntegrationTool;

        return reached.call({ issue: 'ENG-12', body: 'Fixed.' });
      };

      return { comment, fetch, ...secrets };
    };

    const headersOf = (fetch: ReturnType<typeof vi.fn>) =>
      (fetch.mock.calls[0] as unknown as [string, RequestInit])[1]
        .headers as Record<string, string>;

    it('reaches the host wearing a secret bound to it', async () => {
      const { comment, fetch } = wearing({
        LINEAR_API_KEY: { host: 'api.linear.app', value: 'lin_api_1' },
      });

      await comment();

      expect(headersOf(fetch).authorization).toBe('lin_api_1');
    });

    it('grants the run’s current attempt only the secrets the tool’s action wears', async () => {
      const { comment, grant, forRun } = wearing({
        LINEAR_API_KEY: { host: 'api.linear.app', value: 'lin_api_1' },
      });

      await comment();

      expect(grant).toHaveBeenCalledWith({
        workspaceId: 'ws_1',
        runId: 'run_1',
        attempt: 2,
        secrets: ['LINEAR_API_KEY'],
      });
      expect(forRun).toHaveBeenCalledWith({
        workspaceId: 'ws_1',
        runId: 'run_1',
        attempt: 2,
        secrets: ['LINEAR_API_KEY'],
        url: 'https://api.linear.app/graphql',
      });
    });

    it('sends nothing where the secret is bound to another host', async () => {
      const { comment, fetch } = wearing({
        LINEAR_API_KEY: { host: 'api.example.com', value: 'lin_api_1' },
      });

      await expect(comment()).rejects.toMatchObject({
        violation: 'not-allowed',
      });
      expect(fetch).not.toHaveBeenCalled();
    });

    it('sends nothing where the workspace holds no such secret', async () => {
      const { comment, fetch } = wearing({});

      await expect(comment()).rejects.toThrow(
        'The workspace holds no secret named LINEAR_API_KEY',
      );
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  it('carries no secret into an action that wears none', async () => {
    const { comment, run } = using();

    await comment({ body: 'x' });

    const [, against] = run.mock.calls[0] as unknown as [
      unknown,
      Record<string, unknown>,
    ];
    expect(against).not.toHaveProperty('secret');
  });

  it('reads an input the agent left out from the task', async () => {
    const reached = (await using().reaching(
      'linear.comment',
    )) as IntegrationTool;
    expect(reached.defaultFor('issue')).toBe('ENG-12');
  });

  it('says what the host refused', async () => {
    const { comment } = using({
      ok: false,
      status: 400,
      response: { errors: [{ message: 'Entity not found' }] },
      capture: {},
    });

    await expect(comment({ body: 'x' })).rejects.toThrow(UpstreamRefusedError);
    await expect(comment({ body: 'x' })).rejects.toThrow(
      /the integration answered 400: .*Entity not found/,
    );
  });

  it('reaches nothing the team’s configuration does not offer', async () => {
    const { reaching } = using();

    await expect(reaching('linear.close')).resolves.toBeNull();
    await expect(reaching('sentry.comment')).resolves.toBeNull();
  });

  it('hands back the whole answer, however long', async () => {
    const long = 'x'.repeat(9_000);
    const { comment } = using({
      ok: true,
      status: 200,
      response: { url: long },
      capture: { url: long },
    });

    const answered = await comment({ body: 'x' });

    expect(answered).toBe(long);
  });

  describe('a tool generated from an API description', () => {
    const HASH = ContentHash.of('f'.repeat(64));

    const PETSTORE = `integration: petstore
name: Petstore
openapi:
  url: https://petstore3.swagger.io/api/v3/openapi.json
  auth:
    secrets: [secret.PETSTORE_KEY]
`;

    const LINEAR_GRAPHQL = `integration: linear
graphql:
  url: https://api.linear.app/graphql
`;

    const ADD_PET = DescribedOperation.of({
      name: 'add-pet',
      upstream: 'addPet',
      description: 'Add a new pet to the store.',
      inputs: [
        {
          name: 'body',
          schema: InputSchema.of({
            type: 'object',
            required: ['name'],
            properties: { name: { type: 'string' } },
          }),
          required: true,
          description: null,
        },
      ],
      writes: true,
      call: {
        kind: 'http',
        method: 'POST',
        server: 'https://petstore3.swagger.io/api/v3',
        path: '/pet',
        params: [],
        body: { input: 'body', contentType: 'application/json' },
      },
    });

    const ISSUE = DescribedOperation.of({
      name: 'issue',
      upstream: 'issue',
      description: 'Find one issue.',
      inputs: [
        {
          name: 'id',
          schema: InputSchema.ofType('string'),
          required: true,
          description: null,
        },
      ],
      writes: false,
      call: {
        kind: 'graphql',
        endpoint: 'https://api.linear.app/graphql',
        operation: 'query',
        field: 'issue',
        document: 'query issue($id: String!) { issue(id: $id) { id title } }',
        variables: ['id'],
      },
    });

    const generated = (
      text: string,
      operation: DescribedOperation,
      answering: Response,
    ) => {
      const fetch = vi.fn(async () => answering);
      const secrets = injecting({
        PETSTORE_KEY: {
          host: 'petstore3.swagger.io',
          header: 'api_key',
          value: 'special-key',
        },
      });
      const source = String(parseYaml(text).integration);
      const tools = new IntegrationToolCalls(
        {
          ofTeam: vi.fn(async () => [
            defined(text, {
              hash: HASH.value,
              offers: [`${source}.${operation.name}`],
            }),
          ]),
        } as unknown as DefinedIntegrationsPort,
        new CompiledIntegrationRuntime(
          new IntegrationReader(
            expressions,
            operationsHolding(
              DescribedDocument.read({
                hash: HASH,
                kind: 'openapi',
                operations: [operation],
                passedOver: [],
                readAt: new Date('2026-10-05T12:00:00.000Z'),
              }),
            ),
          ),
          new HttpOutbound(['petstore3.swagger.io', 'api.linear.app'], fetch),
          clientsFrom(),
          {} as OAuth2Exchange,
          discoveringNothing(),
          reachingNoServer(),
        ),
        reachFor(secrets.injection),
      );

      return {
        fetch,
        reaching: (tool: string) => tools.reach(tool, task(), ATTEMPT, null),
      };
    };

    it('declares what the operation takes, needing approval because it writes', async () => {
      const reached = await generated(
        PETSTORE,
        ADD_PET,
        new Response('{}'),
      ).reaching('petstore.add-pet');

      expect(reached?.declared).toEqual({
        tool: 'petstore.add-pet',
        integrationName: 'Petstore',
        description: 'Add a new pet to the store.',
        inputs: [
          {
            name: 'body',
            schema: {
              type: 'object',
              properties: { name: { type: 'string' } },
              required: ['name'],
            },
            description: null,
            required: true,
            defaulted: false,
            piped: false,
          },
        ],
        approval: { because: 'It changes data in Petstore.' },
      });
    });

    it('makes the call the operation describes, wearing the description’s secrets', async () => {
      const { fetch, reaching } = generated(
        PETSTORE,
        ADD_PET,
        new Response(JSON.stringify({ id: 10, name: 'doggie' })),
      );
      const reached = (await reaching('petstore.add-pet')) as IntegrationTool;

      await expect(reached.call({ body: { name: 'doggie' } })).resolves.toEqual(
        {
          id: 10,
          name: 'doggie',
        },
      );
      expect(fetch).toHaveBeenCalledWith(
        'https://petstore3.swagger.io/api/v3/pet',
        expect.objectContaining({
          method: 'POST',
          body: '{"name":"doggie"}',
          redirect: 'manual',
          headers: expect.objectContaining({
            api_key: 'special-key',
            'content-type': 'application/json',
          }),
        }),
      );
    });

    it('answers with the field a GraphQL operation selects, and refuses an answer carrying errors', async () => {
      const answered = generated(
        LINEAR_GRAPHQL,
        ISSUE,
        new Response(
          JSON.stringify({ data: { issue: { id: 'i1', title: 'Broken' } } }),
        ),
      );
      const reached = (await answered.reaching(
        'linear.issue',
      )) as IntegrationTool;

      await expect(reached.call({ id: 'i1' })).resolves.toEqual({
        id: 'i1',
        title: 'Broken',
      });

      const refused = generated(
        LINEAR_GRAPHQL,
        ISSUE,
        new Response(
          JSON.stringify({
            data: null,
            errors: [{ message: 'Entity not found' }],
          }),
        ),
      );
      const failing = (await refused.reaching(
        'linear.issue',
      )) as IntegrationTool;

      await expect(failing.call({ id: 'nope' })).rejects.toThrow(
        /the integration answered 200: .*Entity not found/,
      );
    });

    it('reaches nothing the stored reading does not offer', async () => {
      await expect(
        generated(PETSTORE, ADD_PET, new Response('{}')).reaching(
          'petstore.delete-pet',
        ),
      ).resolves.toBeNull();
    });
  });
});
