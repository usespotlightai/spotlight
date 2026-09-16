import type {
  ReachableTool,
  ToolContext,
} from '@application/ports/integration-tools.port';
import type { TeamSecretsPort } from '@application/ports/team-secrets.port';
import type { Factory } from '@domain/aggregates/factory.aggregate';
import type { Line } from '@domain/aggregates/line.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import { InvalidToolInputError } from '@domain/exceptions/invalid-tool-input.error';
import { UpstreamRefusedError } from '@domain/exceptions/upstream-refused.error';
import type { FactoryRepository } from '@domain/repositories/factory.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { Mark } from '@domain/value-objects/mark.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { Tool } from '@domain/value-objects/tool.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { IntegrationReader } from '@infrastructure/integrations/integration.reader';
import type { OAuth2Access } from '@infrastructure/integrations/oauth2-access';
import type {
  HttpOutbound,
  OutboundResult,
} from '@infrastructure/outbound/http-outbound';
import { IntegrationToolUses } from '@infrastructure/outbound/integration-tool-uses';
import { describe, expect, it, vi } from 'vitest';

const LINEAR = `version: 1
integration: linear
actions:
  comment:
    request:
      method: POST
      url: https://api.linear.app/graphql
      auth:
        token:
          secret: secret.LINEAR_API_KEY
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

const line = {
  factoryId: FactoryId.of('factory_1'),
  key: { value: 'delivery' },
  stationAt: () => ({
    name: { value: 'Implementation' },
    key: { value: 'implementation' },
  }),
} as unknown as Line;

const task = (marked = true) => {
  const added = Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: new Date('2026-09-13T09:00:00.000Z'),
    newId: () => 'task_1',
  });

  return marked ? added.markedBy(Mark.of('linear.issue', 'ENG-12')) : added;
};

const using = (
  reply: OutboundResult = {
    ok: true,
    status: 200,
    response: { url: 'https://linear.app/acme/issue/ENG-12#comment-1' },
    capture: { url: 'https://linear.app/acme/issue/ENG-12#comment-1' },
  },
) => {
  const run = vi.fn(
    async (_action: unknown, _against: Record<string, unknown>) => reply,
  );

  const tools = new IntegrationToolUses(
    {
      find: vi.fn(
        async () => ({ teamId: TeamId.of('team_1') }) as unknown as Factory,
      ),
    } as unknown as FactoryRepository,
    {
      findFor: vi.fn(async () => ({
        files: [
          ConfigurationFile.of('.spotlight/integrations/linear.yml', LINEAR),
        ],
      })),
    } as unknown as TeamConfigurationRepository,
    new IntegrationReader(),
    {
      resolveAll: vi.fn(
        async (_team: unknown, names: readonly { value: string }[]) =>
          Object.fromEntries(names.map((name) => [name.value, 'lin_api_1'])),
      ),
    } as unknown as TeamSecretsPort,
    { run } as unknown as HttpOutbound,
    { token: async () => null } as unknown as OAuth2Access,
  );

  const reaching = (tool: string, marked = true) =>
    tools.reach(Tool.of(tool), {
      kind: 'task',
      task: task(marked),
      line,
    } as unknown as ToolContext);

  const comment = async (input: unknown, marked = true) => {
    const reached = (await reaching('linear.comment', marked)) as ReachableTool;
    const inputs = reached.declared.accept(input, (each) =>
      reached.defaultFor(each),
    );

    return reached.call(inputs);
  };

  return { reaching, run, comment };
};

describe('IntegrationToolUses', () => {
  it('reaches a tool the team’s integrations declare, as they declare it', async () => {
    const reached = await using().reaching('linear.comment');

    expect(reached?.declared.tool.value).toBe('linear.comment');
    expect(reached?.declared.inputs.map((each) => each.name)).toEqual([
      'issue',
      'body',
      'count',
    ]);
  });

  it('makes the call the tool’s action describes, and answers with its output', async () => {
    const { comment, run } = using();

    await expect(
      comment({
        issue: 'ENG-7',
        body: 'Fixed in the queue worker.',
        count: '2',
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
      secret: { LINEAR_API_KEY: 'lin_api_1' },
    });
  });

  it('reads an input the agent left out from the task', async () => {
    const { comment, run } = using();

    await comment({ body: 'Fixed.' });

    const [, against] = run.mock.calls[0] as unknown as [
      unknown,
      Record<string, unknown>,
    ];
    expect(against.inputs).toEqual({ issue: 'ENG-12', body: 'Fixed.' });
  });

  describe('refuses what it cannot act on, and calls nothing', () => {
    it('an input it does not take, saying what it does', async () => {
      const { comment, run } = using();

      await expect(comment({ body: 'x', isue: 'ENG-1' })).rejects.toThrow(
        'linear.comment takes no isue; it takes issue, body, count',
      );
      expect(run).not.toHaveBeenCalled();
    });

    it('an input it needs', async () => {
      const { comment } = using();

      await expect(comment({})).rejects.toThrow('linear.comment needs body');
      await expect(comment({ body: 'x' }, false)).rejects.toThrow(
        'needs issue, and this task has nothing to read it from',
      );
    });

    it('an input that is not the type it takes', async () => {
      const { comment, run } = using();

      await expect(comment({ body: 'x', count: 'many' })).rejects.toThrow(
        InvalidToolInputError,
      );
      expect(run).not.toHaveBeenCalled();
    });
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
