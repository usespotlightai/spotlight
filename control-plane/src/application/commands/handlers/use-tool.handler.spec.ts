import { UseToolHandler } from '@application/commands/handlers/use-tool.handler';
import { UseToolCommand } from '@application/commands/use-tool.command';
import { toolManifestOf } from '@application/mappers/tool-manifest.mapper';
import type {
  IntegrationToolsPort,
  ReachableTool,
  ToolContext,
} from '@application/ports/integration-tools.port';
import { BuiltInTools } from '@application/services/built-in-tools.service';
import { RunAtHand } from '@application/services/run-at-hand.service';
import type { Line } from '@domain/aggregates/line.aggregate';
import { Run } from '@domain/aggregates/run.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import { DeclaredTool } from '@domain/entities/declared-tool.entity';
import type { LineRepository } from '@domain/repositories/line.repository';
import type { RunRepository } from '@domain/repositories/run.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { builtInTool, PULL_REQUEST } from '@domain/services/built-in-tools';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunSpec } from '@domain/value-objects/run-spec.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { Tool } from '@domain/value-objects/tool.vo';
import type { ToolInputs } from '@domain/value-objects/tool-inputs.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-12T09:00:00.000Z');

const task = () =>
  Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.between(null, null),
    raisedBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  });

const LINEAR_COMMENT = DeclaredTool.of({
  tool: Tool.of('linear.comment'),
  description: 'Comment on the issue.',
  inputs: [
    {
      name: 'issue',
      type: 'string',
      description: null,
      required: true,
      defaulted: true,
      piped: false,
    },
    {
      name: 'body',
      type: 'string',
      description: null,
      required: true,
      defaulted: false,
      piped: true,
    },
  ],
});

const describedAs = (tool: string) => {
  const declared =
    builtInTool(Tool.of(tool))?.declared ??
    (tool === LINEAR_COMMENT.tool.value
      ? LINEAR_COMMENT
      : DeclaredTool.of({ tool: Tool.of(tool), description: `Use ${tool}.` }));

  return toolManifestOf(declared);
};

const claimed = (
  given: string[] = ['pull-request'],
  over: { dispatchedAt?: string; taskless?: boolean } = {},
) =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    taskId: over.taskless ? null : TaskId.of('task_1'),
    stationId: over.dispatchedAt ? StationId.of(over.dispatchedAt) : null,
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      continuity: { key: 'task:station', keep: true },
      manifest: given.map(describedAs),
    }),
  }).claim(RunnerId.of('runner_1'), NOW);

const LINE = { id: 'line_1' } as unknown as Line;

interface Called {
  readonly tool: string;
  readonly context: ToolContext;
  readonly inputs: ToolInputs;
}

const using = (run: Run = claimed(), over: { lineAt?: string | null } = {}) => {
  const called: Called[] = [];

  const builtIns = new BuiltInTools([
    {
      tool: PULL_REQUEST,
      call: async (context, inputs) => {
        called.push({ tool: PULL_REQUEST.value, context, inputs });
        return 'https://github.com/acme/widgets/pull/7';
      },
    },
  ]);

  const integrationTools: IntegrationToolsPort = {
    reach: async (tool, context): Promise<ReachableTool | null> =>
      tool.equals(LINEAR_COMMENT.tool)
        ? {
            declared: LINEAR_COMMENT,
            defaultFor: (input) =>
              input.name === 'issue' ? 'ENG-12' : undefined,
            call: async (inputs) => {
              called.push({ tool: tool.value, context, inputs });
              return 'https://linear.app/acme/issue/ENG-12#comment-1';
            },
          }
        : null,
  };

  const lineAt = over.lineAt === undefined ? 'station_1' : over.lineAt;

  const handler = new UseToolHandler(
    new RunAtHand(
      { findById: async () => run } as unknown as RunRepository,
      { find: async () => task() } as unknown as TaskRepository,
    ),
    {
      holding: async (stationId: StationId) =>
        stationId.value === lineAt ? LINE : null,
    } as unknown as LineRepository,
    builtIns,
    integrationTools,
  );

  const reach = (tool: string, input: unknown = { title: 'Fix the queue' }) =>
    handler.execute(new UseToolCommand('run_1', 'runner_1', tool, input));

  return { reach, called };
};

describe('UseToolHandler', () => {
  it('hands what the agent gave Spotlight’s own tool to it, for the run’s task and line, and answers with its answer', async () => {
    const { reach, called } = using();

    await expect(reach('pull-request')).resolves.toEqual({
      output: 'https://github.com/acme/widgets/pull/7',
    });
    expect(called).toHaveLength(1);
    expect(called[0]?.inputs.values).toEqual({ title: 'Fix the queue' });
    expect(called[0]?.context.task.id.value).toBe('task_1');
    expect(called[0]?.context.line).toBe(LINE);
  });

  it('refuses what a tool does not take, and calls nothing', async () => {
    const { reach, called } = using();

    await expect(
      reach('pull-request', { title: 'Fix', colour: 'red' }),
    ).rejects.toMatchObject({ kind: 'invalid-input' });
    expect(called).toEqual([]);
  });

  it('refuses a tool the run was not given', async () => {
    const { reach, called } = using(claimed([]));

    await expect(reach('pull-request')).rejects.toMatchObject({
      kind: 'not-allowed',
    });
    expect(called).toEqual([]);
  });

  it('refuses a run that works no task', async () => {
    const { reach, called } = using(
      claimed(['pull-request'], { taskless: true }),
    );

    await expect(reach('pull-request')).rejects.toMatchObject({
      kind: 'conflict',
    });
    expect(called).toEqual([]);
  });

  it('reaches the tool on the line of the station the run was dispatched at, not where its task stands now', async () => {
    const { reach } = using(
      claimed(['pull-request'], { dispatchedAt: 'station_2' }),
      { lineAt: 'station_2' },
    );

    await expect(reach('pull-request')).resolves.toEqual({
      output: 'https://github.com/acme/widgets/pull/7',
    });
  });

  it('refuses where the station stands on no line', async () => {
    const { reach, called } = using(claimed(), { lineAt: null });

    await expect(reach('pull-request')).rejects.toMatchObject({
      kind: 'not-found',
    });
    expect(called).toEqual([]);
  });

  it('says there is no such tool where a run was given one nothing provides', async () => {
    const { reach } = using(claimed(['pull-request', 'teleport']));

    await expect(reach('teleport')).rejects.toMatchObject({
      kind: 'not-found',
    });
  });

  it('hands a tool a team’s integration offers to that integration, reading what the agent left out from the task', async () => {
    const { reach, called } = using(claimed(['linear.comment']));

    await expect(reach('linear.comment', { body: 'Fixed.' })).resolves.toEqual({
      output: 'https://linear.app/acme/issue/ENG-12#comment-1',
    });
    expect(called[0]?.tool).toBe('linear.comment');
    expect(called[0]?.inputs.values).toEqual({
      issue: 'ENG-12',
      body: 'Fixed.',
    });
  });

  it('says there is no such tool where no integration of the team’s offers it', async () => {
    const { reach } = using(claimed(['linear.close']));

    await expect(reach('linear.close')).rejects.toMatchObject({
      kind: 'not-found',
    });
  });

  it('refuses a name nobody would give a tool', async () => {
    const { reach } = using();

    await expect(reach('Pull Request')).rejects.toMatchObject({
      kind: 'invalid-input',
    });
  });
});
