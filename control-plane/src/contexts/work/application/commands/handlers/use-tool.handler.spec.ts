import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { UseToolHandler } from '@work/application/commands/handlers/use-tool.handler';
import { UseToolCommand } from '@work/application/commands/use-tool.command';
import { toolManifestOf } from '@work/application/mappers/tool-manifest.mapper';
import type {
  IntegrationToolsPort,
  ReachableTool,
  TaskToolContext,
  ToolContext,
} from '@work/application/ports/integration-tools.port';
import { BuiltInTools } from '@work/application/services/built-in-tools.service';
import { RunWorks } from '@work/application/services/run-works.service';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import {
  builtInTool,
  CHANGE_STACK,
  PROPOSE_TASK,
  PULL_REQUEST,
} from '@work/domain/services/built-in-tools';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import type { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-12T09:00:00.000Z');

const delivery = (workspaceId = 'ws_1', standsAt = 'station_1') =>
  Line.rehydrate({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of(workspaceId),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: [
      Station.of({
        id: StationId.of(standsAt),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: StationColor.of('#a3a8b0'),
        kind: 'backlog',
      }),
      Station.of({
        id: StationId.of('station_completed'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 1,
        color: StationColor.of('#a3a8b0'),
        kind: 'completed',
      }),
    ],
  });

const added = () =>
  Task.add({
    line: delivery(),
    at: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.between(null, null),
    raisedBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  });

const task = () =>
  Task.rehydrate({ ...added(), currentRunId: RunId.of('run_1') });

const chat = () =>
  Chat.start({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: UserId.of('user_1'),
    harness: HarnessId.of('dev'),
    body: ChatMessageBody.of('Plan the queue.'),
    now: NOW,
    newId: () => 'chat_1',
  }).handedTo(RunId.of('run_1'), NOW);

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
  over: { dispatchedAt?: string; subject?: RunSubject | null } = {},
) =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    subject:
      over.subject !== undefined
        ? over.subject
        : RunSubject.task(
            TaskId.of('task_1'),
            over.dispatchedAt ? StationId.of(over.dispatchedAt) : null,
          ),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      continuity: { key: 'task:station', keep: true },
      manifest: given.map(describedAs),
    }),
  }).claim(RunnerId.of('runner_1'), NOW);

const LINE = { id: 'line_1', stationAt: () => null } as unknown as Line;

interface Called {
  readonly tool: string;
  readonly context: ToolContext;
  readonly inputs: ToolInputs;
}

const using = (
  run: Run = claimed(),
  over: { lineAt?: string | null; task?: Task } = {},
) => {
  const called: Called[] = [];

  const builtIns = new BuiltInTools([
    {
      tool: PULL_REQUEST,
      call: async (context, inputs) => {
        called.push({ tool: PULL_REQUEST.value, context, inputs });
        return 'https://github.com/acme/widgets/pull/7';
      },
    },
    {
      tool: PROPOSE_TASK,
      call: async (context, inputs) => {
        called.push({ tool: PROPOSE_TASK.value, context, inputs });
        return 'Proposed.';
      },
    },
    { tool: CHANGE_STACK, call: async () => 'Drafting.' },
  ]);

  const integrationTools: IntegrationToolsPort = {
    reach: async (tool, context): Promise<ReachableTool | null> =>
      tool.equals(LINEAR_COMMENT.tool) && context.kind === 'task'
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
    new RunWorks(
      { findById: async () => run } as unknown as RunRepository,
      { find: async () => over.task ?? task() } as unknown as TaskRepository,
      { find: async () => chat() } as unknown as ChatRepository,
      {
        holding: async (stationId: StationId) =>
          stationId.value === lineAt ? LINE : null,
        ofTeam: async () => [LINE],
      } as unknown as LineRepository,
    ),
    builtIns,
    integrationTools,
  );

  const reach = (tool: string, input: unknown = { title: 'Fix the queue' }) =>
    handler.execute(new UseToolCommand('run_1', 'runner_1', tool, input));

  return { reach, called };
};

describe('UseToolHandler', () => {
  it('gives no tool to a run its task has let go of', async () => {
    const { reach, called } = using(claimed(), { task: added() });

    await expect(reach('pull-request')).rejects.toThrow();
    expect(called).toEqual([]);
  });

  it('hands what the agent gave Spotlight’s own tool to it, for the run’s task and line, and answers with its answer', async () => {
    const { reach, called } = using();

    await expect(reach('pull-request')).resolves.toEqual({
      output: 'https://github.com/acme/widgets/pull/7',
    });
    expect(called).toHaveLength(1);
    expect(called[0]?.inputs.values).toEqual({ title: 'Fix the queue' });
    const context = called[0]?.context as TaskToolContext;
    expect(context.taskId.value).toBe('task_1');
    expect(context.stationId.value).toBe('station_1');
  });

  it('hands a chat’s tool the chat and the team’s lines', async () => {
    const { reach, called } = using(
      claimed(['propose-task'], {
        subject: RunSubject.chat(ChatId.of('chat_1')),
      }),
    );

    await expect(
      reach('propose-task', {
        line: 'delivery',
        station: 'backlog',
        title: 'Back off',
      }),
    ).resolves.toEqual({ output: 'Proposed.' });
    expect(called[0]?.context.kind).toBe('chat');
  });

  it('reaches no task’s tool from a chat', async () => {
    const { reach, called } = using(
      claimed(['pull-request'], {
        subject: RunSubject.chat(ChatId.of('chat_1')),
      }),
    );

    await expect(reach('pull-request')).rejects.toMatchObject({
      kind: 'not-found',
    });
    expect(called).toEqual([]);
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

  it('refuses a run that works nothing', async () => {
    const { reach, called } = using(
      claimed(['pull-request'], { subject: null }),
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
