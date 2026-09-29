import type {
  CatalogRefusal,
  CatalogRefusalReason,
} from '@catalog/application/contracts/catalog.contract';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';
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
  HookedTaskDto,
  HookedTasksPort,
} from '@work/application/ports/hooked-tasks.port';
import type {
  IntegrationToolsPort,
  ReachableTool,
  TaskToolContext,
  ToolContext,
} from '@work/application/ports/integration-tools.port';
import type {
  BeforeMoment,
  HookVerdict,
  LifecycleHooksPort,
  ToolUsedMoment,
} from '@work/application/ports/lifecycle-hooks.port';
import { BuiltInTools } from '@work/application/services/built-in-tools.service';
import { RunWorks } from '@work/application/services/run-works.service';
import { StationCatalog } from '@work/application/services/station-catalog.service';
import { ToolSources } from '@work/application/services/tool-sources.service';
import { ToolUsedHooks } from '@work/application/services/tool-used-hooks.service';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { ToolUsed } from '@work/domain/events/tool-used.event';
import { RunAttemptOverError } from '@work/domain/exceptions/run-attempt-over.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import {
  builtInTool,
  PROPOSE_TASK,
  PULL_REQUEST,
  REVIEW,
  REVIEW_COMMENT,
} from '@work/domain/services/built-in-tools';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
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

const NEEDS_APPROVAL = ApprovalNeeded.of(
  'linear.comment',
  'It posts publicly, under the team’s name.',
);

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
  over: {
    dispatchedAt?: string;
    subject?: RunSubject | null;
    catalog?: string[];
  } = {},
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
            TaskRevision.of(0),
          ),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      continuity: { key: 'task:station' },
      manifest: given.map(describedAs),
      ...(over.catalog ? { catalog: over.catalog } : {}),
    }),
  }).claim(RunnerId.of('runner_1'), NOW);

const LINE = { id: 'line_1', stationAt: () => null } as unknown as Line;

const HOOKED: HookedTaskDto = {
  taskId: 'task_1',
  workspaceId: 'ws_1',
  teamId: 'team_1',
  title: 'Fix the queue',
  url: 'https://spotlight.test/w/acme/team/team_1/tasks/task_1',
  line: 'delivery',
  station: 'Backlog',
  stationKey: 'backlog',
  marks: {},
  repositories: ['acme/widgets'],
  pullRequest: null,
  runId: 'run_1',
};

interface Hooked {
  readonly before: BeforeMoment[];
  readonly after: { moment: ToolUsedMoment; occurrence: string }[];
  readonly asked: { taskId: string; runId: string | null }[];
}

interface Called {
  readonly tool: string;
  readonly context: ToolContext;
  readonly inputs: ToolInputs;
}

const using = (
  run: Run = claimed(),
  over: {
    lineAt?: string | null;
    task?: Task;
    approval?: ApprovalNeeded | null;
    failing?: boolean;
    movedOnWhileCalling?: boolean;
    verdict?: HookVerdict;
    hooksDown?: boolean;
    afterFails?: boolean;
    recordingFails?: boolean;
    movedOnTo?: Run;
    withheld?: {
      readonly when: 'before' | 'during';
      readonly reason: CatalogRefusalReason;
    };
  } = {},
) => {
  const called: Called[] = [];
  const refusal = (id: string): CatalogRefusal => ({
    id,
    reason: over.withheld?.reason ?? 'lapsed',
    because: 'withheld here',
  });
  const catalog = new StationCatalog({
    givenTo: async (_workspace, named) =>
      over.withheld?.when === 'before'
        ? {
            tools: [],
            skills: [],
            refused: named.tools.map(refusal),
          }
        : {
            tools: named.tools.map((id) => ({
              id,
              description: 'Search the web.',
              inputs: [
                {
                  name: 'query',
                  type: 'string' as const,
                  description: null,
                  required: true,
                  defaulted: false,
                  piped: false,
                },
              ],
            })),
            skills: [],
            refused: [],
          },
    call: async (request) => {
      if (over.withheld?.when === 'during') {
        return { kind: 'refused', refusal: refusal(request.id) };
      }

      called.push({
        tool: request.id,
        context: { kind: 'task' } as TaskToolContext,
        inputs: ToolInputs.of(request.inputs),
      });

      return { kind: 'answered', output: 'Three pages.' };
    },
  });
  let standing = over.task ?? task();
  const tasks = {
    find: async () => standing,
    save: async (saved: Task) => {
      standing = saved;
    },
  } as unknown as TaskRepository;
  const linear = over.approval
    ? DeclaredTool.of({
        tool: LINEAR_COMMENT.tool,
        description: LINEAR_COMMENT.description,
        inputs: LINEAR_COMMENT.inputs,
        approval: over.approval,
      })
    : LINEAR_COMMENT;

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
    ...[REVIEW_COMMENT, REVIEW].map((tool) => ({
      tool,
      call: async () => null,
    })),
  ]);

  const integrationTools: IntegrationToolsPort = {
    reach: async (tool, context): Promise<ReachableTool | null> =>
      tool.equals(LINEAR_COMMENT.tool) && context.kind === 'task'
        ? {
            declared: linear,
            defaultFor: (input) =>
              input.name === 'issue' ? 'ENG-12' : undefined,
            call: async (inputs) => {
              if (over.movedOnWhileCalling) {
                throw new RunAttemptOverError('run_1', 1);
              }
              called.push({ tool: tool.value, context, inputs });
              if (over.failing) {
                throw new UpstreamRefusedError('using linear.comment', 'down');
              }
              return 'https://linear.app/acme/issue/ENG-12#comment-1';
            },
          }
        : null,
  };

  const lineAt = over.lineAt === undefined ? 'station_1' : over.lineAt;

  const hooked: Hooked = { before: [], after: [], asked: [] };
  const recorded: DomainEvent[] = [];
  const hookedTasks: HookedTasksPort = {
    of: async (taskId: string, runId: string | null) => {
      hooked.asked.push({ taskId, runId });
      return HOOKED;
    },
    ofPullRequest: async () => null,
  };
  const hooks: LifecycleHooksPort = {
    listens: async () => true,
    before: async (_task, moment) => {
      if (over.hooksDown) {
        throw new Error('the hooks are unreachable');
      }
      hooked.before.push(moment);
      return over.verdict ?? { kind: 'allowed' };
    },
    after: async (_task, moment, occurrence) => {
      if (over.afterFails) {
        throw new Error('the hooks are down');
      }
      hooked.after.push({ moment, occurrence });
    },
  };
  const afterwards = new ToolUsedHooks(hookedTasks, hooks);

  const found = over.movedOnTo ? [run, over.movedOnTo] : [run];
  const handler = new UseToolHandler(
    new RunWorks(
      {
        findById: async () =>
          (found.length > 1 ? found.shift() : found[0]) ?? null,
      } as unknown as RunRepository,
      tasks,
      { find: async () => chat() } as unknown as ChatRepository,
      {
        holding: async (stationId: StationId) =>
          stationId.value === lineAt ? LINE : null,
        ofTeam: async () => [LINE],
      } as unknown as LineRepository,
      { now: () => NOW, sleep: async () => {} },
    ),
    new ToolSources(builtIns, integrationTools, catalog),
    hookedTasks,
    hooks,
    { generate: () => 'occurrence_1' },
    {
      dispatch: async (events) => {
        if (over.recordingFails) {
          throw new Error('the outbox is unreachable');
        }
        recorded.push(...events);
      },
    },
  );

  const delivered = async () => {
    for (const event of recorded) {
      if (event instanceof ToolUsed) {
        await afterwards.on(event);
      }
    }
  };

  const reach = async (
    tool: string,
    input: unknown = { title: 'Fix the queue' },
  ) => {
    try {
      return await handler.execute(
        new UseToolCommand('run_1', 'runner_1', tool, input),
      );
    } finally {
      if (!over.afterFails) {
        await delivered();
      }
    }
  };

  return {
    reach,
    called,
    standing: () => standing,
    hooked,
    recorded,
    delivered,
  };
};

describe('UseToolHandler', () => {
  describe('a catalog tool', () => {
    const searching = () =>
      claimed(['catalog.web-search'], {
        catalog: ['catalog.web-search@1.1.0'],
      });

    it('is called by name, at the version the run was dispatched with', async () => {
      const { reach, called } = using(searching());

      await expect(
        reach('catalog.web-search', { query: 'queues' }),
      ).resolves.toEqual({ output: 'Three pages.' });
      expect(called[0]?.tool).toBe('catalog.web-search@1.1.0');
      expect(called[0]?.inputs.values).toEqual({ query: 'queues' });
    });

    it('is refused as entitlement_lapsed once the plan no longer covers it, and nothing is called', async () => {
      const { reach, called } = using(searching(), {
        withheld: { when: 'before', reason: 'lapsed' },
      });

      await expect(
        reach('catalog.web-search', { query: 'queues' }),
      ).rejects.toMatchObject({
        kind: 'not-allowed',
        message: expect.stringContaining('entitlement_lapsed'),
      });
      expect(called).toEqual([]);
    });

    it('is refused as entitlement_lapsed when the plan lapses as it is called', async () => {
      const { reach } = using(searching(), {
        withheld: { when: 'during', reason: 'lapsed' },
      });

      await expect(
        reach('catalog.web-search', { query: 'queues' }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('entitlement_lapsed'),
      });
    });

    it('is refused as catalog_item_unknown, not as a lapse, once the catalog no longer has it', async () => {
      const { reach, called } = using(searching(), {
        withheld: { when: 'before', reason: 'unknown' },
      });

      await expect(
        reach('catalog.web-search', { query: 'queues' }),
      ).rejects.toMatchObject({
        kind: 'not-allowed',
        message: 'catalog_item_unknown: withheld here',
      });
      expect(called).toEqual([]);
    });

    it('is not found where the run pinned no version of it', async () => {
      const { reach } = using(claimed(['catalog.web-search']));

      await expect(
        reach('catalog.web-search', { query: 'queues' }),
      ).rejects.toMatchObject({ kind: 'not-found' });
    });
  });

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

  it('puts a tool that needs approving to a person instead of calling it, the run waiting on their answer', async () => {
    const { reach, called, standing } = using(claimed(['linear.comment']), {
      approval: NEEDS_APPROVAL,
    });

    await expect(
      reach('linear.comment', { body: 'Fixed.' }),
    ).rejects.toMatchObject({ kind: 'conflict' });
    expect(called).toEqual([]);

    const asked = standing().notes[standing().notes.length - 1];
    expect(asked?.kind).toBe('asked');
    expect(asked?.form).toBe('approval');
    expect(asked?.approval?.subject.kind).toBe('tool-call');
    expect(asked?.approval?.subject.name).toBe('linear.comment');
    expect(asked?.approval?.subject.given).toEqual([
      { name: 'body', value: 'Fixed.' },
      { name: 'issue', value: 'ENG-12' },
    ]);
    expect(asked?.approval?.because).toBe(NEEDS_APPROVAL.because);
    expect(asked?.approval?.standing).toBe('asked');
    expect(asked?.approval?.at.value).toBe('station_1');
    expect(asked?.body.value).toContain('It posts publicly');
    expect(asked?.body.value).toContain('Fixed.');
    expect(standing().running).toBe(true);
    expect(standing().working).toBe(false);
  });

  it('asks once while a person still owes an answer', async () => {
    const { reach, standing } = using(claimed(['linear.comment']), {
      approval: NEEDS_APPROVAL,
    });

    await expect(reach('linear.comment', { body: 'Fixed.' })).rejects.toThrow();
    const asked = standing().notes.length;
    await expect(reach('linear.comment', { body: 'Fixed.' })).rejects.toThrow();

    expect(standing().notes).toHaveLength(asked);
  });

  it('calls a tool the person approved, and spends that approval on the one call', async () => {
    const approved = task().clearFor(
      ApprovalSubject.toolCall(
        ToolCall.of(
          Tool.of('linear.comment'),
          ToolInputs.of({ issue: 'ENG-12', body: 'Fixed.' }),
        ),
      ),
      NEEDS_APPROVAL,
      {
        station: StationName.of('Backlog'),
        body: TaskNoteBody.of('Approve linear.comment?'),
        at: NOW,
        voice: Voice.station(RunId.of('run_1')),
      },
      RunId.of('run_1'),
    ).task;

    const { reach, called, standing } = using(claimed(['linear.comment']), {
      approval: NEEDS_APPROVAL,
      task: Task.rehydrate({
        ...approved.answered(
          NotePosition.of(approved.notes.length - 1),
          {
            station: StationName.of('Backlog'),
            body: TaskNoteBody.of('Approved.'),
            at: NOW,
            voice: Voice.person(UserId.of('user_1')),
          },
          'granted',
        ),
        currentRunId: RunId.of('run_1'),
      }),
    });

    await expect(reach('linear.comment', { body: 'Fixed.' })).resolves.toEqual({
      output: 'https://linear.app/acme/issue/ENG-12#comment-1',
    });
    expect(called).toHaveLength(1);
    expect(
      standing().notes.find((note) => note.approval)?.approval?.spent,
    ).toBe(true);
  });

  it('keeps the approval spent, and reports no failure, where the call succeeded but could not be recorded', async () => {
    const asked = task().clearFor(
      ApprovalSubject.toolCall(
        ToolCall.of(
          Tool.of('linear.comment'),
          ToolInputs.of({ issue: 'ENG-12', body: 'Fixed.' }),
        ),
      ),
      NEEDS_APPROVAL,
      {
        station: StationName.of('Backlog'),
        body: TaskNoteBody.of('Approve linear.comment?'),
        at: NOW,
        voice: Voice.station(RunId.of('run_1')),
      },
      RunId.of('run_1'),
    ).task;
    const granted = asked.answered(
      NotePosition.of(asked.notes.length - 1),
      {
        station: StationName.of('Backlog'),
        body: TaskNoteBody.of('Approved.'),
        at: NOW,
        voice: Voice.person(UserId.of('user_1')),
      },
      'granted',
    );

    const { reach, called, standing, recorded } = using(
      claimed(['linear.comment']),
      {
        approval: NEEDS_APPROVAL,
        recordingFails: true,
        task: Task.rehydrate({ ...granted, currentRunId: RunId.of('run_1') }),
      },
    );

    await expect(reach('linear.comment', { body: 'Fixed.' })).rejects.toThrow(
      'the outbox is unreachable',
    );
    expect(called).toHaveLength(1);
    expect(recorded).toEqual([]);
    const approval = standing().notes.find((note) => note.approval)?.approval;
    expect(approval?.spent).toBe(true);
    expect(approval?.grants).toBe(false);
  });

  it('hands the approval back where the call it was spent on failed', async () => {
    const asked = task().clearFor(
      ApprovalSubject.toolCall(
        ToolCall.of(
          Tool.of('linear.comment'),
          ToolInputs.of({ issue: 'ENG-12', body: 'Fixed.' }),
        ),
      ),
      NEEDS_APPROVAL,
      {
        station: StationName.of('Backlog'),
        body: TaskNoteBody.of('Approve linear.comment?'),
        at: NOW,
        voice: Voice.station(RunId.of('run_1')),
      },
      RunId.of('run_1'),
    ).task;
    const granted = asked.answered(
      NotePosition.of(asked.notes.length - 1),
      {
        station: StationName.of('Backlog'),
        body: TaskNoteBody.of('Approved.'),
        at: NOW,
        voice: Voice.person(UserId.of('user_1')),
      },
      'granted',
    );

    const { reach, called, standing } = using(claimed(['linear.comment']), {
      approval: NEEDS_APPROVAL,
      failing: true,
      task: Task.rehydrate({ ...granted, currentRunId: RunId.of('run_1') }),
    });

    await expect(
      reach('linear.comment', { body: 'Fixed.' }),
    ).rejects.toMatchObject({ kind: 'refused-upstream' });
    expect(called).toHaveLength(1);
    expect(
      standing().notes.find((note) => note.approval)?.approval?.grants,
    ).toBe(true);
  });

  it('refuses a tool the person rejected, in their own words, without asking again', async () => {
    const asked = task().clearFor(
      ApprovalSubject.toolCall(
        ToolCall.of(
          Tool.of('linear.comment'),
          ToolInputs.of({ issue: 'ENG-12', body: 'Fixed.' }),
        ),
      ),
      NEEDS_APPROVAL,
      {
        station: StationName.of('Backlog'),
        body: TaskNoteBody.of('Approve linear.comment?'),
        at: NOW,
        voice: Voice.station(RunId.of('run_1')),
      },
      RunId.of('run_1'),
    ).task;
    const rejected = asked.answered(
      NotePosition.of(asked.notes.length - 1),
      {
        station: StationName.of('Backlog'),
        body: TaskNoteBody.of('Not before the release.'),
        at: NOW,
        voice: Voice.person(UserId.of('user_1')),
      },
      'refused',
    );

    const { reach, called, standing } = using(claimed(['linear.comment']), {
      approval: NEEDS_APPROVAL,
      task: Task.rehydrate({ ...rejected, currentRunId: RunId.of('run_1') }),
    });
    const before = standing().notes.length;

    await expect(
      reach('linear.comment', { body: 'Fixed.' }),
    ).rejects.toMatchObject({ kind: 'not-allowed' });
    expect(called).toEqual([]);
    expect(standing().notes).toHaveLength(before);
  });

  it('asks again where the person answered in words without deciding', async () => {
    const asked = task().clearFor(
      ApprovalSubject.toolCall(
        ToolCall.of(
          Tool.of('linear.comment'),
          ToolInputs.of({ issue: 'ENG-12', body: 'Fixed.' }),
        ),
      ),
      NEEDS_APPROVAL,
      {
        station: StationName.of('Backlog'),
        body: TaskNoteBody.of('Approve linear.comment?'),
        at: NOW,
        voice: Voice.station(RunId.of('run_1')),
      },
      RunId.of('run_1'),
    ).task;
    const talkedBack = asked.answered(NotePosition.of(asked.notes.length - 1), {
      station: StationName.of('Backlog'),
      body: TaskNoteBody.of('Mention the ticket too.'),
      at: NOW,
      voice: Voice.person(UserId.of('user_1')),
    });

    const { reach, called, standing } = using(claimed(['linear.comment']), {
      approval: NEEDS_APPROVAL,
      task: Task.rehydrate({ ...talkedBack, currentRunId: RunId.of('run_1') }),
    });

    await expect(
      reach('linear.comment', { body: 'Fixed.' }),
    ).rejects.toMatchObject({ kind: 'conflict' });
    expect(called).toEqual([]);
    expect(standing().notes.filter((note) => note.approval?.open)).toHaveLength(
      2,
    );
    expect(standing().awaitingReview).toBe(true);
  });

  it('asks again where the agent changed what it would send', async () => {
    const asked = task().clearFor(
      ApprovalSubject.toolCall(
        ToolCall.of(
          Tool.of('linear.comment'),
          ToolInputs.of({ issue: 'ENG-12', body: 'Fixed.' }),
        ),
      ),
      NEEDS_APPROVAL,
      {
        station: StationName.of('Backlog'),
        body: TaskNoteBody.of('Approve linear.comment?'),
        at: NOW,
        voice: Voice.station(RunId.of('run_1')),
      },
      RunId.of('run_1'),
    ).task;
    const granted = asked.answered(
      NotePosition.of(asked.notes.length - 1),
      {
        station: StationName.of('Backlog'),
        body: TaskNoteBody.of('Approved.'),
        at: NOW,
        voice: Voice.person(UserId.of('user_1')),
      },
      'granted',
    );

    const { reach, called } = using(claimed(['linear.comment']), {
      approval: NEEDS_APPROVAL,
      task: Task.rehydrate({ ...granted, currentRunId: RunId.of('run_1') }),
    });

    await expect(
      reach('linear.comment', { body: 'Something else.' }),
    ).rejects.toMatchObject({ kind: 'conflict' });
    expect(called).toEqual([]);
  });

  it('tells the agent in the manifest that a tool has to be approved', () => {
    expect(
      toolManifestOf(
        DeclaredTool.of({
          tool: LINEAR_COMMENT.tool,
          description: LINEAR_COMMENT.description,
          approval: NEEDS_APPROVAL,
        }),
      ).description,
    ).toContain('Needs a person’s approval');
  });

  describe('hooks', () => {
    it('asks the hooks before a tool is used, with what it will be given', async () => {
      const { reach, hooked } = using(claimed(['linear.comment']));

      await reach('linear.comment', { body: 'Fixed.' });

      expect(hooked.asked[0]).toEqual({ taskId: 'task_1', runId: 'run_1' });
      expect(hooked.before).toEqual([
        {
          on: 'tool.using',
          tool: 'linear.comment',
          inputs: { issue: 'ENG-12', body: 'Fixed.' },
        },
      ]);
    });

    it('calls nothing and tells the agent why when a hook refuses', async () => {
      const { reach, called, hooked } = using(claimed(['linear.comment']), {
        verdict: {
          kind: 'refused',
          reason: 'The hook core/dba-review refused: not on a Friday.',
        },
      });

      await expect(
        reach('linear.comment', { body: 'Fixed.' }),
      ).rejects.toMatchObject({
        kind: 'not-allowed',
        message:
          'linear.comment was held back by a hook, so nothing was sent. The hook core/dba-review refused: not on a Friday.',
      });
      expect(called).toEqual([]);
      expect(hooked.after).toEqual([]);
    });

    it('asks the hooks nothing while the tool waits on a person’s approval', async () => {
      const { reach, hooked } = using(claimed(['linear.comment']), {
        approval: NEEDS_APPROVAL,
      });

      await expect(
        reach('linear.comment', { body: 'Fixed.' }),
      ).rejects.toMatchObject({ kind: 'conflict' });
      await expect(
        reach('linear.comment', { body: 'Fixed.' }),
      ).rejects.toMatchObject({ kind: 'conflict' });
      expect(hooked.before).toEqual([]);
    });

    it('hands a person’s approval back when a hook refuses the call it was spent on', async () => {
      const asked = task().clearFor(
        ApprovalSubject.toolCall(
          ToolCall.of(
            Tool.of('linear.comment'),
            ToolInputs.of({ issue: 'ENG-12', body: 'Fixed.' }),
          ),
        ),
        NEEDS_APPROVAL,
        {
          station: StationName.of('Backlog'),
          body: TaskNoteBody.of('Approve linear.comment?'),
          at: NOW,
          voice: Voice.station(RunId.of('run_1')),
        },
        RunId.of('run_1'),
      ).task;
      const granted = asked.answered(
        NotePosition.of(asked.notes.length - 1),
        {
          station: StationName.of('Backlog'),
          body: TaskNoteBody.of('Approved.'),
          at: NOW,
          voice: Voice.person(UserId.of('user_1')),
        },
        'granted',
      );

      const { reach, called, hooked, standing } = using(
        claimed(['linear.comment']),
        {
          approval: NEEDS_APPROVAL,
          verdict: { kind: 'refused', reason: 'Not today.' },
          task: Task.rehydrate({ ...granted, currentRunId: RunId.of('run_1') }),
        },
      );

      await expect(
        reach('linear.comment', { body: 'Fixed.' }),
      ).rejects.toMatchObject({ kind: 'not-allowed' });
      expect(hooked.before).toHaveLength(1);
      expect(called).toEqual([]);
      const approval = standing().notes.find((note) => note.approval)?.approval;
      expect(approval?.grants).toBe(true);
      expect(approval?.spent).toBe(false);
    });

    it('hands a person’s approval back when the hooks could not be asked', async () => {
      const asked = task().clearFor(
        ApprovalSubject.toolCall(
          ToolCall.of(
            Tool.of('linear.comment'),
            ToolInputs.of({ issue: 'ENG-12', body: 'Fixed.' }),
          ),
        ),
        NEEDS_APPROVAL,
        {
          station: StationName.of('Backlog'),
          body: TaskNoteBody.of('Approve linear.comment?'),
          at: NOW,
          voice: Voice.station(RunId.of('run_1')),
        },
        RunId.of('run_1'),
      ).task;
      const granted = asked.answered(
        NotePosition.of(asked.notes.length - 1),
        {
          station: StationName.of('Backlog'),
          body: TaskNoteBody.of('Approved.'),
          at: NOW,
          voice: Voice.person(UserId.of('user_1')),
        },
        'granted',
      );

      const { reach, called, standing } = using(claimed(['linear.comment']), {
        approval: NEEDS_APPROVAL,
        hooksDown: true,
        task: Task.rehydrate({ ...granted, currentRunId: RunId.of('run_1') }),
      });

      await expect(reach('linear.comment', { body: 'Fixed.' })).rejects.toThrow(
        'the hooks are unreachable',
      );
      expect(called).toEqual([]);
      const approval = standing().notes.find((note) => note.approval)?.approval;
      expect(approval?.grants).toBe(true);
      expect(approval?.spent).toBe(false);
    });

    it('calls nothing where the run moved on to another attempt while the hooks were asked', async () => {
      const held = claimed(['linear.comment']);
      const { reach, called, hooked } = using(held, {
        movedOnTo: held
          .requeue(held.leaseExpiresAt as Date)
          .claim(RunnerId.of('runner_1'), NOW),
      });

      await expect(
        reach('linear.comment', { body: 'Fixed.' }),
      ).rejects.toMatchObject({ kind: 'conflict' });
      expect(hooked.before).toHaveLength(1);
      expect(called).toEqual([]);
      expect(hooked.after).toEqual([]);
    });

    it('hands the approval back and records no use where the run moved on as the tool was about to be called', async () => {
      const asked = task().clearFor(
        ApprovalSubject.toolCall(
          ToolCall.of(
            Tool.of('linear.comment'),
            ToolInputs.of({ issue: 'ENG-12', body: 'Fixed.' }),
          ),
        ),
        NEEDS_APPROVAL,
        {
          station: StationName.of('Backlog'),
          body: TaskNoteBody.of('Approve linear.comment?'),
          at: NOW,
          voice: Voice.station(RunId.of('run_1')),
        },
        RunId.of('run_1'),
      ).task;
      const granted = asked.answered(
        NotePosition.of(asked.notes.length - 1),
        {
          station: StationName.of('Backlog'),
          body: TaskNoteBody.of('Approved.'),
          at: NOW,
          voice: Voice.person(UserId.of('user_1')),
        },
        'granted',
      );
      const { reach, called, recorded, standing } = using(
        claimed(['linear.comment']),
        {
          approval: NEEDS_APPROVAL,
          movedOnWhileCalling: true,
          task: Task.rehydrate({ ...granted, currentRunId: RunId.of('run_1') }),
        },
      );

      await expect(
        reach('linear.comment', { body: 'Fixed.' }),
      ).rejects.toMatchObject({ kind: 'conflict' });
      expect(called).toEqual([]);
      expect(recorded).toEqual([]);
      const approval = standing().notes.find((note) => note.approval)?.approval;
      expect(approval?.spent).toBe(false);
    });

    it('tells the hooks a tool was used, with what it answered', async () => {
      const { reach, hooked } = using(claimed(['linear.comment']));

      await reach('linear.comment', { body: 'Fixed.' });

      expect(hooked.after).toEqual([
        {
          moment: {
            on: 'tool.used',
            tool: 'linear.comment',
            inputs: { issue: 'ENG-12', body: 'Fixed.' },
            output: 'https://linear.app/acme/issue/ENG-12#comment-1',
            failed: false,
          },
          occurrence: 'occurrence_1',
        },
      ]);
    });

    it('carries what a tool answered as text, whatever its fields are called', async () => {
      const { reach, recorded } = using(claimed(['linear.comment']));

      await reach('linear.comment', { body: 'Fixed.' });

      expect((recorded[0] as ToolUsed).output.json).toBe(
        '"https://linear.app/acme/issue/ENG-12#comment-1"',
      );
    });

    it('tells the hooks a tool failed, and still answers with its failure', async () => {
      const { reach, hooked } = using(claimed(['linear.comment']), {
        failing: true,
      });

      await expect(
        reach('linear.comment', { body: 'Fixed.' }),
      ).rejects.toMatchObject({ kind: 'refused-upstream' });
      expect(hooked.after[0]?.moment.failed).toBe(true);
      expect(hooked.after[0]?.moment.output).toMatch(/down/);
    });

    it('answers with the tool’s answer, leaving the hooks after it to their own reaction', async () => {
      const { reach, recorded, delivered } = using(
        claimed(['linear.comment']),
        {
          afterFails: true,
        },
      );

      await expect(
        reach('linear.comment', { body: 'Fixed.' }),
      ).resolves.toEqual({
        output: 'https://linear.app/acme/issue/ENG-12#comment-1',
      });
      expect(recorded).toEqual([expect.any(ToolUsed)]);
      await expect(delivered()).rejects.toThrow('the hooks are down');
    });

    it('asks no hooks about a chat’s tool', async () => {
      const { reach, hooked } = using(
        claimed(['propose-task'], {
          subject: RunSubject.chat(ChatId.of('chat_1')),
        }),
      );

      await reach('propose-task', {
        line: 'delivery',
        station: 'backlog',
        title: 'Back off',
      });

      expect(hooked.before).toEqual([]);
      expect(hooked.after).toEqual([]);
    });
  });
});
