import type { HeldSecretsPort } from '@configuration/application/ports/held-secrets.port';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import { HostReach } from '@integrations/application/services/host-reach.service';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import { IntegrationToolCalls } from '@integrations/infrastructure/acl/integration-tool-calls.adapter';
import { CompiledIntegrationRuntime } from '@integrations/infrastructure/integrations/compiled-integration.runtime';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { OAuth2Clients } from '@integrations/infrastructure/integrations/oauth2-clients';
import type { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import type {
  HttpOutbound,
  OutboundResult,
} from '@integrations/infrastructure/outbound/http-outbound';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { ToolInputValues } from '@work/application/contracts/tools.contract';
import type { BoundTaskDto } from '@work/application/dto/bound-task.dto';
import type { IntegrationTool } from '@work/application/ports/integration-tool-calls.port';
import { describe, expect, it, vi } from 'vitest';

const expressions = new CelExpressionEngine();

const runtimeWith = (
  outbound: unknown,
  exchange: unknown = {},
  clients: OAuth2Clients = OAuth2Clients.from('{}'),
) =>
  new CompiledIntegrationRuntime(
    new IntegrationReader(expressions),
    outbound as HttpOutbound,
    clients,
    exchange as OAuth2Exchange,
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
  over: { file?: string; held?: readonly string[] } = {},
) => {
  const run = vi.fn(
    async (_action: unknown, _against: Record<string, unknown>) => reply,
  );

  const tools = new IntegrationToolCalls(
    {
      ofTeam: vi.fn(async () => [defined(over.file ?? LINEAR)]),
    } as unknown as DefinedIntegrationsPort,
    runtimeWith({ run } as unknown as HttpOutbound),
    new HostReach(
      {
        held: async () => (over.held ?? []).map((each) => SecretName.of(each)),
      } satisfies HeldSecretsPort,
      { of: async () => null } as unknown as HostConnectionRepository,
    ),
  );

  const reaching = (tool: string, marked = true) =>
    tools.reach(tool, task(marked));

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

  describe('an action that reads a secret', () => {
    const READS_A_SECRET = LINEAR.replace(
      '      url: https://api.linear.app/graphql\n',
      '      url: https://api.linear.app/graphql\n      auth:\n        token:\n          secret: secret.LINEAR_API_KEY\n',
    );

    it('is refused where the team does not hold the secret', async () => {
      const { comment, run } = using(undefined, { file: READS_A_SECRET });

      await expect(comment({ body: 'x' })).rejects.toMatchObject({
        violation: 'conflict',
        message:
          'The linear integration reads secret.LINEAR_API_KEY, which the team does not hold',
      });
      expect(run).not.toHaveBeenCalled();
    });

    it('is made where the team holds the secret', async () => {
      const { comment, run } = using(undefined, {
        file: READS_A_SECRET,
        held: ['LINEAR_API_KEY'],
      });

      await comment({ body: 'x' });

      expect(run).toHaveBeenCalledTimes(1);
    });
  });

  it('reads an input the agent left out from the task', async () => {
    const reached = (await using().reaching(
      'linear.comment',
    )) as IntegrationTool;
    const issue = reached.declared.inputs.find((each) => each.name === 'issue');

    expect(issue && reached.defaultFor(issue)).toBe('ENG-12');
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
});
