import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { OAuth2ClientsPort } from '@integrations/application/ports/oauth2-clients.port';
import { PersonToolPolicy } from '@integrations/domain/aggregates/person-tool-policy.aggregate';
import { SpecDocument } from '@integrations/domain/aggregates/spec-document.aggregate';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { PersonToolRule } from '@integrations/domain/value-objects/person-tool-rule.vo';
import { SpecOperation } from '@integrations/domain/value-objects/spec-operation.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { IntegrationToolCalls } from '@integrations/infrastructure/acl/integration-tool-calls.adapter';
import { CompiledIntegrationRuntime } from '@integrations/infrastructure/integrations/compiled-integration.runtime';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import {
  HttpOutbound,
  type OutboundResult,
} from '@integrations/infrastructure/outbound/http-outbound';
import { allowingOutbound } from '@integrations/infrastructure/outbound/outbound-policy.fake-spec';
import { clientsFrom } from '@integrations/integrations.clients.fake-spec';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { operationsContaining } from '@integrations/integrations.documents.fake-spec';
import {
  InMemoryInferredOutputSchemas,
  inferringInto,
} from '@integrations/integrations.inferred.fake-spec';
import {
  callingNoServer,
  discoveringNothing,
} from '@integrations/integrations.mcp.fake-spec';
import {
  InMemoryPersonToolPolicies,
  personRulesFrom,
} from '@integrations/integrations.policies.fake-spec';
import {
  callAuthFor,
  injecting,
} from '@integrations/integrations.secrets.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';
import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { ToolInputValues } from '@work/application/contracts/tools.contract';
import type { IntegrationTaskViewDto } from '@work/application/dto/integration-task-view.dto';
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
    new IntegrationReader(expressions, operationsContaining()),
    outbound as HttpOutbound,
    clients,
    exchange as OAuth2Exchange,
    discoveringNothing(),
    callingNoServer(),
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
    action: comment
    description: Comment on the Linear issue this task came from.
    inputs:
      issue:
        default: '\${{ task.marks["linear.issue"] }}'
        required: true
      body:
        required: true
        stdin: true
      count:
        type: number
    output: '\${{ capture.url }}'
`;

const task = (marked = true): IntegrationTaskViewDto => ({
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
  over: {
    file?: string;
    schemas?: InMemoryInferredOutputSchemas;
    policies?: InMemoryPersonToolPolicies;
  } = {},
) => {
  const run = vi.fn(
    async (_action: unknown, _against: Record<string, unknown>) => reply,
  );
  const schemas = over.schemas ?? new InMemoryInferredOutputSchemas();

  const tools = new IntegrationToolCalls(
    {
      ofTeam: vi.fn(async () => [defined(over.file ?? LINEAR)]),
    } as unknown as DefinedIntegrationsPort,
    runtimeWith({ run } as unknown as HttpOutbound),
    callAuthFor(),
    inferringInto(schemas),
    personRulesFrom(over.policies),
  );

  const resolving = (tool: string, marked = true) =>
    tools.resolve(tool, task(marked), ATTEMPT, null);

  const comment = async (inputs: ToolInputValues, marked = true) => {
    const resolved = (await resolving(
      'linear.comment',
      marked,
    )) as IntegrationTool;

    return resolved.call(inputs);
  };

  return { resolving, run, comment, schemas, tools };
};

const usingApproved = () =>
  using(undefined, {
    file: LINEAR.replace(
      '    action: comment\n',
      '    action: comment\n    approval:\n      because: It posts publicly, under the team’s name.\n',
    ),
  });

describe('IntegrationToolCalls', () => {
  it('resolves a tool the team’s integrations declare, as they declare it', async () => {
    const resolved = await using().resolving('linear.comment');

    expect(resolved?.declared.tool).toBe('linear.comment');
    expect(resolved?.declared.inputs.map((each) => each.name)).toEqual([
      'issue',
      'body',
      'count',
    ]);
  });

  it('carries no approval where the file requests none', async () => {
    const resolved = await using().resolving('linear.comment');

    expect(resolved?.declared.approval).toBeNull();
  });

  it('carries into Work the approval a tool may only be used with', async () => {
    const resolved = await usingApproved().resolving('linear.comment');

    expect(resolved?.declared.approval).toEqual({
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

  describe('an action that injects a secret', () => {
    const INJECTS_A_SECRET = LINEAR.replace(
      '      url: https://api.linear.app/graphql\n',
      '      url: https://api.linear.app/graphql\n      auth:\n        secrets: [secret.LINEAR_API_KEY]\n',
    );

    const injectingAction = (
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
          ofTeam: vi.fn(async () => [defined(INJECTS_A_SECRET)]),
        } as unknown as DefinedIntegrationsPort,
        runtimeWith(new HttpOutbound(allowingOutbound(allowed), fetch)),
        callAuthFor(secrets.injection),
        inferringInto(),
        personRulesFrom(),
      );

      const comment = async () => {
        const resolved = (await tools.resolve(
          'linear.comment',
          task(),
          ATTEMPT,
          null,
        )) as IntegrationTool;

        return resolved.call({ issue: 'ENG-12', body: 'Fixed.' });
      };

      return { comment, fetch, ...secrets };
    };

    const headersOf = (fetch: ReturnType<typeof vi.fn>) =>
      (fetch.mock.calls[0] as unknown as [string, RequestInit])[1]
        .headers as Record<string, string>;

    it('calls the host and injects a secret bound to it', async () => {
      const { comment, fetch } = injectingAction({
        LINEAR_API_KEY: { host: 'api.linear.app', value: 'lin_api_1' },
      });

      await comment();

      expect(headersOf(fetch).authorization).toBe('lin_api_1');
    });

    it('grants the run’s current attempt only the secrets that the tool’s action injects', async () => {
      const { comment, grant, forRun } = injectingAction({
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
      const { comment, fetch } = injectingAction({
        LINEAR_API_KEY: { host: 'api.example.com', value: 'lin_api_1' },
      });

      await expect(comment()).rejects.toMatchObject({
        kind: 'not-allowed',
      });
      expect(fetch).not.toHaveBeenCalled();
    });

    it('sends nothing where the workspace has no such secret', async () => {
      const { comment, fetch } = injectingAction({});

      await expect(comment()).rejects.toThrow(
        'Secret LINEAR_API_KEY not found. Please create it first.',
      );
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  it('carries no secret into an action that injects none', async () => {
    const { comment, run } = using();

    await comment({ body: 'x' });

    const [, against] = run.mock.calls[0] as unknown as [
      unknown,
      Record<string, unknown>,
    ];
    expect(against).not.toHaveProperty('secret');
  });

  it('infers what the tool answered, and only from a call that succeeded', async () => {
    const { comment, schemas } = using();

    await comment({ body: 'Fixed.' });

    const output = await vi.waitFor(async () => {
      const [stored] = await schemas.ofTools(TeamId.of('team_1'), [
        'linear.comment',
      ]);
      expect(stored).toBeDefined();
      return stored;
    });
    expect(output?.tool.value).toBe('linear.comment');
    expect(output?.shape.schema).toEqual({ type: 'string' });

    const failingService = using({
      ok: false,
      status: 500,
      response: null,
      capture: {},
    });
    await expect(failingService.comment({ body: 'Fixed.' })).rejects.toThrow();
    expect(
      await failingService.schemas.ofTools(TeamId.of('team_1'), [
        'linear.comment',
      ]),
    ).toEqual([]);
  });

  it('answers the call even when what it answered cannot be inferred', async () => {
    const schemas = new InMemoryInferredOutputSchemas();
    vi.spyOn(schemas, 'save').mockRejectedValue(new Error('database gone'));

    await expect(
      using(undefined, { schemas: schemas }).comment({ body: 'Fixed.' }),
    ).resolves.toBe('https://linear.app/acme/issue/ENG-12#comment-1');
  });

  it('ignores a person’s rule where the call acts with the team’s connection', async () => {
    const policies = new InMemoryPersonToolPolicies();
    await policies.save(
      PersonToolPolicy.none({
        teamId: TeamId.of('team_1'),
        personId: UserId.of('user_alice'),
        integration: IntegrationKey.of('linear'),
      }).set(ToolName.of('linear.comment'), PersonToolRule.of('blocked')),
    );
    const { tools } = using(undefined, { policies });

    const resolved = await tools.resolve(
      'linear.comment',
      task(),
      ATTEMPT,
      'user_alice',
    );

    expect(resolved?.personRule).toBeNull();
  });

  it('reads an input the agent left out from the task', async () => {
    const resolved = (await using().resolving(
      'linear.comment',
    )) as IntegrationTool;
    expect(resolved.defaultFor('issue')).toBe('ENG-12');
  });

  it('says what error the service answered with', async () => {
    const { comment } = using({
      ok: false,
      status: 400,
      response: { errors: [{ message: 'Entity not found' }] },
      capture: {},
    });

    await expect(comment({ body: 'x' })).rejects.toThrow(UpstreamError);
    await expect(comment({ body: 'x' })).rejects.toThrow(
      /the integration answered 400: .*Entity not found/,
    );
  });

  it('resolves nothing the team’s configuration does not offer', async () => {
    const { resolving } = using();

    await expect(resolving('linear.close')).resolves.toBeNull();
    await expect(resolving('sentry.comment')).resolves.toBeNull();
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

  describe('a tool generated from an API spec', () => {
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

    const ADD_PET = SpecOperation.of({
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

    const ISSUE = SpecOperation.of({
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
      operation: SpecOperation,
      answering: Response,
    ) => {
      const fetch = vi.fn(async () => answering);
      const secrets = injecting({
        PETSTORE_KEY: {
          host: 'petstore3.swagger.io',
          name: 'api_key',
          value: 'special-key',
        },
      });
      const integration = String(parseYaml(text).integration);
      const tools = new IntegrationToolCalls(
        {
          ofTeam: vi.fn(async () => [
            defined(text, {
              hash: HASH.value,
              tools: [`${integration}.${operation.name}`],
            }),
          ]),
        } as unknown as DefinedIntegrationsPort,
        new CompiledIntegrationRuntime(
          new IntegrationReader(
            expressions,
            operationsContaining(
              SpecDocument.read({
                hash: HASH,
                kind: 'openapi',
                operations: [operation],
                skipped: [],
                readAt: new Date('2026-10-05T12:00:00.000Z'),
              }),
            ),
          ),
          new HttpOutbound(
            allowingOutbound(['petstore3.swagger.io', 'api.linear.app']),
            fetch,
          ),
          clientsFrom(),
          {} as OAuth2Exchange,
          discoveringNothing(),
          callingNoServer(),
        ),
        callAuthFor(secrets.injection),
        inferringInto(),
        personRulesFrom(),
      );

      return {
        fetch,
        resolving: (tool: string) => tools.resolve(tool, task(), ATTEMPT, null),
      };
    };

    it('declares what the operation takes, needing approval because it writes', async () => {
      const resolved = await generated(
        PETSTORE,
        ADD_PET,
        new Response('{}'),
      ).resolving('petstore.add-pet');

      expect(resolved?.declared).toEqual({
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
            stdin: false,
          },
        ],
        approval: { because: 'It changes data in Petstore.' },
        inferredOutput: null,
      });
    });

    it('makes the call the operation describes, and injects the spec’s secrets', async () => {
      const { fetch, resolving } = generated(
        PETSTORE,
        ADD_PET,
        new Response(JSON.stringify({ id: 10, name: 'doggie' })),
      );
      const resolved = (await resolving('petstore.add-pet')) as IntegrationTool;

      await expect(
        resolved.call({ body: { name: 'doggie' } }),
      ).resolves.toEqual({
        id: 10,
        name: 'doggie',
      });
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

    it('answers with the field a GraphQL operation selects, and fails on an answer carrying errors', async () => {
      const answered = generated(
        LINEAR_GRAPHQL,
        ISSUE,
        new Response(
          JSON.stringify({ data: { issue: { id: 'i1', title: 'Broken' } } }),
        ),
      );
      const resolved = (await answered.resolving(
        'linear.issue',
      )) as IntegrationTool;

      await expect(resolved.call({ id: 'i1' })).resolves.toEqual({
        id: 'i1',
        title: 'Broken',
      });

      const withErrors = generated(
        LINEAR_GRAPHQL,
        ISSUE,
        new Response(
          JSON.stringify({
            data: null,
            errors: [{ message: 'Entity not found' }],
          }),
        ),
      );
      const failing = (await withErrors.resolving(
        'linear.issue',
      )) as IntegrationTool;

      await expect(failing.call({ id: 'nope' })).rejects.toThrow(
        /the integration answered 200: .*Entity not found/,
      );
    });

    it('resolves nothing the stored fetch does not offer', async () => {
      await expect(
        generated(PETSTORE, ADD_PET, new Response('{}')).resolving(
          'petstore.delete-pet',
        ),
      ).resolves.toBeNull();
    });
  });
});
