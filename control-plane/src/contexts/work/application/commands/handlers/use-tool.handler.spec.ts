import type {
  CatalogRefusal,
  CatalogRefusalReason,
} from '@catalog/application/contracts/catalog.contract';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
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
import type { ConnectionWantedDto } from '@work/application/ports/integration-tool-calls.port';
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
  SETUP_PULL_REQUEST,
} from '@work/domain/services/built-in-tools';
import type { PersonRule } from '@work/domain/services/stricter-rule';
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
import { ToolActingAs } from '@work/domain/value-objects/tool-acting-as.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { ToolRule } from '@work/domain/value-objects/tool-rule.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-12T09:00:00.000Z');

const delivery = (workspaceId = 'ws_1', backlogId = 'station_1') =>
  Line.rehydrate({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of(workspaceId),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: [
      Station.of({
        id: StationId.of(backlogId),
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
      schema: InputSchema.ofType('string'),
      description: null,
      required: true,
      defaulted: true,
      piped: false,
    },
    {
      name: 'body',
      schema: InputSchema.ofType('string'),
      description: null,
      required: true,
      defaulted: false,
      piped: true,
    },
  ],
  offeredBy: 'Linear',
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

const LINE = {
  id: 'line_1',
  teamId: TeamId.of('team_1'),
  stationAt: () => null,
} as unknown as Line;

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
    wants?: ConnectionWantedDto;
    actingAs?: ToolActingAs;
    personRule?: PersonRule;
    denied?: {
      readonly when: 'before' | 'during';
      readonly reason: CatalogRefusalReason;
    };
  } = {},
) => {
  const called: Called[] = [];
  const refusal = (id: string): CatalogRefusal => ({
    id,
    reason: over.denied?.reason ?? 'lapsed',
    because: 'denied here',
  });
  const catalog = new StationCatalog({
    givenTo: async (_workspace, named) =>
      over.denied?.when === 'before'
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
                  schema: { type: 'string' },
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
      if (over.denied?.when === 'during') {
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
  let current = over.task ?? task();
  const tasks = {
    find: async () => current,
    save: async (saved: Task) => {
      current = saved;
    },
  } as unknown as TaskRepository;
  const linear = over.approval
    ? DeclaredTool.of({
        tool: LINEAR_COMMENT.tool,
        description: LINEAR_COMMENT.description,
        inputs: LINEAR_COMMENT.inputs,
        approval: over.approval,
        offeredBy: LINEAR_COMMENT.offeredBy,
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
    ...[REVIEW_COMMENT, REVIEW, SETUP_PULL_REQUEST].map((tool) => ({
      tool,
      call: async () => null,
    })),
  ]);

  const integrationTools: IntegrationToolsPort = {
    reach: async (tool, context): Promise<ReachableTool | null> =>
      tool.equals(LINEAR_COMMENT.tool) && context.kind === 'task'
        ? {
            declared: linear,
            actingAs: over.actingAs ?? null,
            wants: over.wants ?? null,
            personRule: over.personRule ?? null,
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
        findByStation: async (stationId: StationId) =>
          stationId.value === lineAt ? LINE : null,
        ofTeam: async () => [LINE],
      } as unknown as LineRepository,
      { of: async () => null },
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
    current: () => current,
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
      ).resolves.toEqual({ output: 'Three pages.', actingAs: null });
      expect(called[0]?.tool).toBe('catalog.web-search@1.1.0');
      expect(called[0]?.inputs.values).toEqual({ query: 'queues' });
    });

    it('is refused as entitlement_lapsed once the plan no longer covers it, and nothing is called', async () => {
      const { reach, called } = using(searching(), {
        denied: { when: 'before', reason: 'lapsed' },
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
        denied: { when: 'during', reason: 'lapsed' },
      });

      await expect(
        reach('catalog.web-search', { query: 'queues' }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('entitlement_lapsed'),
      });
    });

    it('is refused as catalog_item_unknown, not as a lapse, once the catalog no longer has it', async () => {
      const { reach, called } = using(searching(), {
        denied: { when: 'before', reason: 'unknown' },
      });

      await expect(
        reach('catalog.web-search', { query: 'queues' }),
      ).rejects.toMatchObject({
        kind: 'not-allowed',
        message: 'catalog_item_unknown: denied here',
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
      actingAs: null,
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
    ).resolves.toEqual({ output: 'Proposed.', actingAs: null });
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
    ).rejects.toMatchObject({ kind: 'invalid' });
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

  it('reaches the tool on the line of the station the run was dispatched at, not where its task is now', async () => {
    const { reach } = using(
      claimed(['pull-request'], { dispatchedAt: 'station_2' }),
      { lineAt: 'station_2' },
    );

    await expect(reach('pull-request')).resolves.toEqual({
      output: 'https://github.com/acme/widgets/pull/7',
      actingAs: null,
    });
  });

  it('refuses where the station is on no line', async () => {
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
      actingAs: null,
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
      kind: 'invalid',
    });
  });

  it('puts a tool that needs approving to a person instead of calling it, the run waiting on their answer', async () => {
    const { reach, called, current } = using(claimed(['linear.comment']), {
      approval: NEEDS_APPROVAL,
    });

    await expect(
      reach('linear.comment', { body: 'Fixed.' }),
    ).rejects.toMatchObject({ kind: 'conflict' });
    expect(called).toEqual([]);

    const asked = current().notes[current().notes.length - 1];
    expect(asked?.kind).toBe('asked');
    expect(asked?.form).toBe('approval');
    expect(asked?.approval?.subject.kind).toBe('tool-call');
    expect(asked?.approval?.subject.name).toBe('linear.comment');
    expect(asked?.approval?.subject.given).toEqual([
      { name: 'body', value: 'Fixed.' },
      { name: 'issue', value: 'ENG-12' },
    ]);
    expect(asked?.approval?.because).toBe(NEEDS_APPROVAL.because);
    expect(asked?.approval?.status).toBe('asked');
    expect(asked?.approval?.at.value).toBe('station_1');
    expect(asked?.body.value).toContain('It posts publicly');
    expect(asked?.body.value).toContain('Fixed.');
    expect(current().running).toBe(true);
    expect(current().working).toBe(false);
  });

  it('keeps what the agent said it wants to do on the ask, apart from what the tool takes', async () => {
    const { reach, current } = using(claimed(['linear.comment']), {
      approval: NEEDS_APPROVAL,
    });

    await expect(
      reach('linear.comment', {
        body: 'Fixed.',
        intent: 'post the fix on ENG-12, publicly under the team’s name',
      }),
    ).rejects.toMatchObject({ kind: 'conflict' });

    const asked = current().notes[current().notes.length - 1]?.approval;
    expect(asked?.intent?.value).toBe(
      'post the fix on ENG-12, publicly under the team’s name',
    );
    expect(asked?.subject.given.map((each) => each.name)).toEqual([
      'body',
      'issue',
    ]);
  });

  it('asks once while a person still owes an answer', async () => {
    const { reach, current } = using(claimed(['linear.comment']), {
      approval: NEEDS_APPROVAL,
    });

    await expect(reach('linear.comment', { body: 'Fixed.' })).rejects.toThrow();
    const asked = current().notes.length;
    await expect(reach('linear.comment', { body: 'Fixed.' })).rejects.toThrow();

    expect(current().notes).toHaveLength(asked);
  });

  describe('a rule the person it acts as set', () => {
    const ALICE = UserId.of('user_alice');

    const ruling = (rule: string): PersonRule => ({
      rule: ToolRule.of(rule),
      personId: ALICE,
      personName: 'Alice',
    });

    const lastAsked = (current: () => Task) =>
      current().notes[current().notes.length - 1]?.approval;

    it('asks them first where they ask to approve a tool the team allows', async () => {
      const { reach, called, current } = using(claimed(['linear.comment']), {
        personRule: ruling('needs-approval'),
      });

      await expect(
        reach('linear.comment', { body: 'Fixed.', intent: 'post the fix' }),
      ).rejects.toMatchObject({ kind: 'conflict' });

      expect(called).toEqual([]);
      expect(lastAsked(current)?.askedOf?.equals(ALICE)).toBe(true);
      expect(lastAsked(current)?.because).toBe(
        'Alice asks to approve each call made with their Linear connection.',
      );
      expect(lastAsked(current)?.intent?.value).toBe('post the fix');
    });

    it('still asks the team where they allow a tool the team gates', async () => {
      const { reach, called, current } = using(claimed(['linear.comment']), {
        approval: NEEDS_APPROVAL,
        personRule: ruling('allowed'),
      });

      await expect(
        reach('linear.comment', { body: 'Fixed.' }),
      ).rejects.toMatchObject({ kind: 'conflict' });

      expect(called).toEqual([]);
      expect(lastAsked(current)?.askedOf).toBeNull();
      expect(lastAsked(current)?.because).toBe(NEEDS_APPROVAL.because);
    });

    it('asks only them, for the team’s reason, where both ask', async () => {
      const { reach, current } = using(claimed(['linear.comment']), {
        approval: NEEDS_APPROVAL,
        personRule: ruling('needs-approval'),
      });

      await expect(
        reach('linear.comment', { body: 'Fixed.' }),
      ).rejects.toThrow();

      expect(lastAsked(current)?.askedOf?.equals(ALICE)).toBe(true);
      expect(lastAsked(current)?.because).toBe(NEEDS_APPROVAL.because);
    });

    it('sends nothing and asks nobody where they block it, whatever the team says', async () => {
      for (const approval of [null, NEEDS_APPROVAL]) {
        const { reach, called, current } = using(claimed(['linear.comment']), {
          approval,
          personRule: ruling('blocked'),
        });
        const before = current().notes.length;

        await expect(
          reach('linear.comment', { body: 'Fixed.' }),
        ).rejects.toMatchObject({
          kind: 'not-allowed',
          message: expect.stringContaining('Alice blocks it'),
        });
        expect(called).toEqual([]);
        expect(current().notes).toHaveLength(before);
      }
    });
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
      null,
    ).task;

    const { reach, called, current } = using(claimed(['linear.comment']), {
      approval: NEEDS_APPROVAL,
      task: Task.rehydrate({
        ...approved.answer(
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
      actingAs: null,
    });
    expect(called).toHaveLength(1);
    expect(current().notes.find((note) => note.approval)?.approval?.spent).toBe(
      true,
    );
  });

  it('calls the tool with what the person changed it to, where they approved it with changes', async () => {
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
      null,
    ).task;

    const { reach, called } = using(claimed(['linear.comment']), {
      approval: NEEDS_APPROVAL,
      task: Task.rehydrate({
        ...approved.answer(
          NotePosition.of(approved.notes.length - 1),
          {
            station: StationName.of('Backlog'),
            body: TaskNoteBody.of('Approved.'),
            at: NOW,
            voice: Voice.person(UserId.of('user_1')),
          },
          'granted',
          { issue: 'ENG-12', body: 'Fixed in #41.' },
        ),
        currentRunId: RunId.of('run_1'),
      }),
    });

    await reach('linear.comment', { body: 'Fixed.' });

    expect(called.map((each) => each.inputs.values)).toEqual([
      { issue: 'ENG-12', body: 'Fixed in #41.' },
    ]);
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
      null,
    ).task;
    const granted = asked.answer(
      NotePosition.of(asked.notes.length - 1),
      {
        station: StationName.of('Backlog'),
        body: TaskNoteBody.of('Approved.'),
        at: NOW,
        voice: Voice.person(UserId.of('user_1')),
      },
      'granted',
    );

    const { reach, called, current, recorded } = using(
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
    const approval = current().notes.find((note) => note.approval)?.approval;
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
      null,
    ).task;
    const granted = asked.answer(
      NotePosition.of(asked.notes.length - 1),
      {
        station: StationName.of('Backlog'),
        body: TaskNoteBody.of('Approved.'),
        at: NOW,
        voice: Voice.person(UserId.of('user_1')),
      },
      'granted',
    );

    const { reach, called, current } = using(claimed(['linear.comment']), {
      approval: NEEDS_APPROVAL,
      failing: true,
      task: Task.rehydrate({ ...granted, currentRunId: RunId.of('run_1') }),
    });

    await expect(
      reach('linear.comment', { body: 'Fixed.' }),
    ).rejects.toMatchObject({ kind: 'refused' });
    expect(called).toHaveLength(1);
    expect(
      current().notes.find((note) => note.approval)?.approval?.grants,
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
      null,
    ).task;
    const rejected = asked.answer(
      NotePosition.of(asked.notes.length - 1),
      {
        station: StationName.of('Backlog'),
        body: TaskNoteBody.of('Not before the release.'),
        at: NOW,
        voice: Voice.person(UserId.of('user_1')),
      },
      'refused',
    );

    const { reach, called, current } = using(claimed(['linear.comment']), {
      approval: NEEDS_APPROVAL,
      task: Task.rehydrate({ ...rejected, currentRunId: RunId.of('run_1') }),
    });
    const before = current().notes.length;

    await expect(
      reach('linear.comment', { body: 'Fixed.' }),
    ).rejects.toMatchObject({ kind: 'not-allowed' });
    expect(called).toEqual([]);
    expect(current().notes).toHaveLength(before);
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
      null,
    ).task;
    const talkedBack = asked.answer(NotePosition.of(asked.notes.length - 1), {
      station: StationName.of('Backlog'),
      body: TaskNoteBody.of('Mention the ticket too.'),
      at: NOW,
      voice: Voice.person(UserId.of('user_1')),
    });

    const { reach, called, current } = using(claimed(['linear.comment']), {
      approval: NEEDS_APPROVAL,
      task: Task.rehydrate({ ...talkedBack, currentRunId: RunId.of('run_1') }),
    });

    await expect(
      reach('linear.comment', { body: 'Fixed.' }),
    ).rejects.toMatchObject({ kind: 'conflict' });
    expect(called).toEqual([]);
    expect(current().notes.filter((note) => note.approval?.open)).toHaveLength(
      2,
    );
    expect(current().awaitingReview).toBe(true);
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
      null,
    ).task;
    const granted = asked.answer(
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
          'A hook stopped linear.comment, so nothing was sent. The hook core/dba-review refused: not on a Friday.',
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
        null,
      ).task;
      const granted = asked.answer(
        NotePosition.of(asked.notes.length - 1),
        {
          station: StationName.of('Backlog'),
          body: TaskNoteBody.of('Approved.'),
          at: NOW,
          voice: Voice.person(UserId.of('user_1')),
        },
        'granted',
      );

      const { reach, called, hooked, current } = using(
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
      const approval = current().notes.find((note) => note.approval)?.approval;
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
        null,
      ).task;
      const granted = asked.answer(
        NotePosition.of(asked.notes.length - 1),
        {
          station: StationName.of('Backlog'),
          body: TaskNoteBody.of('Approved.'),
          at: NOW,
          voice: Voice.person(UserId.of('user_1')),
        },
        'granted',
      );

      const { reach, called, current } = using(claimed(['linear.comment']), {
        approval: NEEDS_APPROVAL,
        hooksDown: true,
        task: Task.rehydrate({ ...granted, currentRunId: RunId.of('run_1') }),
      });

      await expect(reach('linear.comment', { body: 'Fixed.' })).rejects.toThrow(
        'the hooks are unreachable',
      );
      expect(called).toEqual([]);
      const approval = current().notes.find((note) => note.approval)?.approval;
      expect(approval?.grants).toBe(true);
      expect(approval?.spent).toBe(false);
    });

    it('calls nothing where the run moved on to another attempt while the hooks were asked', async () => {
      const leased = claimed(['linear.comment']);
      const { reach, called, hooked } = using(leased, {
        movedOnTo: leased
          .requeue(leased.leaseExpiresAt as Date)
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
        null,
      ).task;
      const granted = asked.answer(
        NotePosition.of(asked.notes.length - 1),
        {
          station: StationName.of('Backlog'),
          body: TaskNoteBody.of('Approved.'),
          at: NOW,
          voice: Voice.person(UserId.of('user_1')),
        },
        'granted',
      );
      const { reach, called, recorded, current } = using(
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
      const approval = current().notes.find((note) => note.approval)?.approval;
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
      ).rejects.toMatchObject({ kind: 'refused' });
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
        actingAs: null,
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

  describe('a tool that acts as the person who started the task', () => {
    const WANTED: ConnectionWantedDto = {
      source: 'linear',
      integration: 'Linear',
      personId: 'user_1',
      because: 'not-connected',
    };

    it('asks that person to connect, sends nothing, and never asks for approval', async () => {
      const { reach, called, current, recorded } = using(
        claimed(['linear.comment']),
        { wants: WANTED, approval: NEEDS_APPROVAL },
      );

      await expect(
        reach('linear.comment', { body: 'Fixed.' }),
      ).rejects.toMatchObject({
        kind: 'conflict',
        message: expect.stringContaining("haven't connected Linear"),
      });

      const asked = current().notes[current().notes.length - 1];
      expect(called).toEqual([]);
      expect(recorded).toEqual([]);
      expect(asked?.form).toBe('connection');
      expect(asked?.approval).toBeNull();
      expect(asked?.connectionAsk?.personId.value).toBe('user_1');
      expect(asked?.connectionAsk?.source).toBe('linear');
      expect(current().assignee?.value).toBe('user_1');
      expect(current().awaitingReview).toBe(true);
    });

    it('asks only once while the person has not answered', async () => {
      const { reach, current } = using(claimed(['linear.comment']), {
        wants: WANTED,
      });

      await expect(
        reach('linear.comment', { body: 'Fixed.' }),
      ).rejects.toThrow();
      const once = current().notes.length;
      await expect(
        reach('linear.comment', { body: 'Fixed.' }),
      ).rejects.toThrow();

      expect(current().notes.length).toBe(once);
    });

    it('is refused, never falling back to the team, when nobody started the task', async () => {
      const { reach, called, current } = using(claimed(['linear.comment']), {
        wants: { ...WANTED, personId: null, because: 'no-requester' },
      });

      await expect(
        reach('linear.comment', { body: 'Fixed.' }),
      ).rejects.toMatchObject({
        kind: 'not-allowed',
        message: expect.stringContaining('nobody started this task'),
      });
      expect(called).toEqual([]);
      expect(current().awaitingReview).toBe(false);
    });

    it('is refused, asking nobody, while the task already waits on someone else', async () => {
      const waitingOnApproval = task().clearFor(
        ApprovalSubject.toolCall(
          ToolCall.of(
            Tool.of('linear.comment'),
            ToolInputs.of({ issue: 'ENG-12', body: 'Other.' }),
          ),
        ),
        NEEDS_APPROVAL,
        {
          station: StationName.of('Backlog'),
          body: TaskNoteBody.of('Approve?'),
          at: NOW,
          voice: Voice.station(RunId.of('run_1')),
        },
        RunId.of('run_1'),
        null,
      ).task;
      const { reach, called, current } = using(claimed(['linear.comment']), {
        wants: WANTED,
        task: waitingOnApproval,
      });

      await expect(
        reach('linear.comment', { body: 'Fixed.' }),
      ).rejects.toMatchObject({
        kind: 'not-allowed',
        message: expect.stringContaining('already waiting on someone'),
      });
      expect(called).toEqual([]);
      expect(current().notes.some((each) => each.connectionAsk !== null)).toBe(
        false,
      );
    });

    it('is refused when the person who started it left the team', async () => {
      const { reach, called } = using(claimed(['linear.comment']), {
        wants: { ...WANTED, because: 'not-a-member' },
      });

      await expect(
        reach('linear.comment', { body: 'Fixed.' }),
      ).rejects.toMatchObject({
        kind: 'not-allowed',
        message: expect.stringContaining('no longer on the team'),
      });
      expect(called).toEqual([]);
    });

    it('records whose connection the call acted with, and answers with it', async () => {
      const { reach, recorded } = using(claimed(['linear.comment']), {
        actingAs: ToolActingAs.person(UserId.of('user_1'), '@alice'),
      });

      await expect(
        reach('linear.comment', { body: 'Fixed.' }),
      ).resolves.toEqual({
        output: 'https://linear.app/acme/issue/ENG-12#comment-1',
        actingAs: { holder: 'person', personId: 'user_1', handle: '@alice' },
      });

      const used = recorded.find((each) => each instanceof ToolUsed) as
        | ToolUsed
        | undefined;
      expect(used?.actingAs?.personId?.value).toBe('user_1');
      expect(used?.actingAs?.handle).toBe('@alice');
    });
  });
});
