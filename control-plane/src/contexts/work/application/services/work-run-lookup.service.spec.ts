import type {
  JournalStep,
  RunChanges,
  RunJournal,
} from '@runs/application/contracts/run-journal.contract';
import type {
  RunFacts,
  RunFactsPort,
} from '@runs/application/ports/run-facts.port';
import { runJournalReadings } from '@runs/application/ports/run-journal-readings.fake-spec';
import type { RunLeasesPort } from '@runs/application/ports/run-leases.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  DispatchedFor,
  DispatchedRunsPort,
} from '@work/application/ports/dispatched-runs.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import { WorkRunLookup } from '@work/application/services/work-run-lookup.service';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { deliveryLineOf } from '@work/domain/value-objects/line-map.fake-spec';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const TEAM = TeamId.of('team_1');
const RUN = RunId.of('run_1');
const RUNNER = RunnerId.of('runner_1');

let next = 0;
const fresh = () => {
  next += 1;
  return `id_${next}`;
};

const line = deliveryLineOf({
  workspaceId: WORKSPACE,
  teamId: TEAM,
  newId: fresh,
});

const stationKeyed = (key: string): StationId =>
  line.stations.find((each) => each.key.value === key)?.id ??
  StationId.of('station_gone');

const factsOf = (over: Partial<RunFacts> = {}): RunFacts =>
  ({
    runId: RUN,
    workspaceId: WORKSPACE,
    state: 'completed',
    ended: true,
    attempt: 1,
    stopRequested: false,
    turn: null,
    suspendedAt: null,
    claimedBy: RUNNER,
    harness: HarnessId.of('claude-code'),
    requester: {
      owner: 'work',
      kind: 'task',
      id: 'task_1',
      token: '1',
      team: TEAM.value,
    },
    policy: {
      holdsTurn: true,
      gated: true,
      actsBeyondItself: true,
      asks: 'requester',
      listed: true,
      exclusive: true,
    },
    team: TEAM,
    checkouts: ['api', 'web'],
    check: 'npm run verify',
    setups: new Map([['api', 'npm ci']]),
    placement: RunnerPlacement.anywhere(),
    queuedAt: new Date(0),
    startedAt: new Date(0),
    endedAt: new Date(0),
    started: true,
    askedAPerson: false,
    failed: false,
    startedFrom: null,
    ...over,
  }) as RunFacts;

const taskAt = (key: string): DispatchedFor => ({
  kind: 'task',
  taskId: TaskId.of('task_1'),
  stationId: stationKeyed(key),
});

interface Seen {
  readonly facts?: RunFacts | null;
  readonly leased?: boolean;
  readonly for?: DispatchedFor | null;
  readonly lineGone?: boolean;
  readonly journal?: RunJournal | null;
  readonly changesOfTask?: readonly RunChanges[];
}

const API = Repository.of('acme/api');
const WEB = Repository.of('acme/web');

const lookingUp = (seen: Seen) => {
  const facts = seen.facts === undefined ? factsOf() : seen.facts;

  return new WorkRunLookup(
    { of: async () => (facts ? [facts] : []) } as unknown as RunFactsPort,
    {
      leasedBy: async () =>
        seen.leased && facts ? { ...facts, manifest: [], pins: [] } : null,
    } as unknown as RunLeasesPort,
    {
      of: async () =>
        seen.for === null
          ? null
          : {
              runId: RUN,
              for: seen.for ?? taskAt('implementation'),
              briefedMemories: { briefed: [], omitted: [] },
            },
    } as unknown as DispatchedRunsPort,
    { find: async () => null } as unknown as TaskRepository,
    {
      find: async () => ({ teamId: TEAM, repositories: [WEB] }),
    } as unknown as ChatRepository,
    {
      findByStation: async () => (seen.lineGone ? null : line),
    } as unknown as LineMapsPort,
    {
      ofRun: async () => seen.journal ?? null,
      changesOfTask: async () => seen.changesOfTask ?? [],
    } as unknown as RunJournalReaderPort,
    runJournalReadings(),
  );
};

describe('WorkRunLookup, looking up a run', () => {
  const runAt = (key: string, over: Partial<RunFacts> = {}) =>
    lookingUp({ facts: factsOf(over), for: taskAt(key) }).run(RUN);

  it('hands a check the command and setups its run was dispatched with', async () => {
    const found = await runAt('implementation');

    expect(found?.check).toBe('npm run verify');
    expect(found?.setups.get('api')).toBe('npm ci');
    expect(found?.checkouts).toBe(2);
  });

  it('says the run records its decisions where its station does', async () => {
    expect((await runAt('implementation'))?.decisions).toBe(true);
    expect((await runAt('spec'))?.decisions).toBe(false);
  });

  it('places a check where its run was placed', async () => {
    expect(
      (await runAt('gone', { placement: RunnerPlacement.of(['vpc-internal']) }))
        ?.placement.labelGroups,
    ).toEqual([['vpc-internal']]);
  });

  it('says whether the run completed, not only whether it ended', async () => {
    expect((await runAt('implementation'))?.completed).toBe(true);
    expect(
      (await runAt('implementation', { state: 'failed' }))?.completed,
    ).toBe(false);
  });

  it('names the task of a task’s run, and none for a trial, which is isolated', async () => {
    expect((await runAt('implementation'))?.taskId?.value).toBe('task_1');
    expect((await runAt('implementation'))?.trial).toBe(false);
    expect((await runAt('implementation'))?.isolated).toBe(false);

    const trial = await lookingUp({
      facts: factsOf({
        policy: { ...factsOf().policy, actsBeyondItself: false },
      }),
      for: {
        kind: 'trial',
        stationId: stationKeyed('implementation'),
        asOf: new Date(0),
        repositories: [WEB],
      },
    }).run(RUN);

    expect(trial?.taskId).toBeNull();
    expect(trial?.trial).toBe(true);
    expect(trial?.isolated).toBe(true);
  });

  it('knows no run it has no facts of', async () => {
    expect(await lookingUp({ facts: null }).run(RUN)).toBeNull();
  });
});

describe('WorkRunLookup, saying where a run worked', () => {
  it('names its team, line and station', async () => {
    const location = await lookingUp({}).locationOf(RUN);

    expect(location?.teamId.equals(TEAM)).toBe(true);
    expect(location?.lineId).toBe(line.id.value);
    expect(location?.stationName).toBe('Implementation');
  });

  it('names nowhere for a run whose station is gone', async () => {
    expect(await lookingUp({ for: taskAt('gone') }).locationOf(RUN)).toBeNull();
  });
});

describe('WorkRunLookup, finding the run a runner leases', () => {
  const leased = (seen: Seen) =>
    lookingUp({ leased: true, ...seen }).leasedBy(RUN, RUNNER);

  it('names the team, line, station and task of a task’s run', async () => {
    const found = await leased({});

    expect(found?.teamId.equals(TEAM)).toBe(true);
    expect(found?.lineId).toBe(line.id.value);
    expect(found?.stationId).toBe(stationKeyed('implementation').value);
    expect(found?.taskId?.value).toBe('task_1');
    expect(found?.asOf).toBeNull();
    expect(found?.trial).toBe(false);
  });

  it('names a trial’s team and repositories, as of when its original started, even once its station is gone', async () => {
    const asOf = new Date('2026-09-27T11:00:00.000Z');
    const found = await leased({
      facts: factsOf({
        policy: { ...factsOf().policy, actsBeyondItself: false },
      }),
      lineGone: true,
      for: {
        kind: 'trial',
        stationId: stationKeyed('implementation'),
        asOf,
        repositories: [WEB],
      },
    });

    expect(found?.teamId.equals(TEAM)).toBe(true);
    expect(found?.lineId).toBeNull();
    expect(found?.stationId).toBeNull();
    expect(found?.repositories).toEqual([WEB]);
    expect(found?.asOf).toEqual(asOf);
    expect(found?.trial).toBe(true);
    expect(found?.isolated).toBe(true);
  });

  it('says an isolated run without a dispatch works for its team, with no repositories', async () => {
    const found = await leased({
      facts: factsOf({
        policy: { ...factsOf().policy, actsBeyondItself: false },
      }),
      for: null,
    });

    expect(found?.isolated).toBe(true);
    expect(found?.trial).toBe(false);
    expect(found?.teamId.equals(TEAM)).toBe(true);
    expect(found?.repositories).toEqual([]);
  });

  it('names a chat’s team and repositories for a chat’s run', async () => {
    const found = await leased({
      for: { kind: 'chat', chatId: ChatId.of('chat_1') },
    });

    expect(found?.repositories).toEqual([WEB]);
    expect(found?.taskId).toBeNull();
  });

  it('knows no run the runner does not lease, or one working for no team', async () => {
    expect(await lookingUp({ leased: false }).leasedBy(RUN, RUNNER)).toBeNull();
    expect(await leased({ facts: factsOf({ team: null }) })).toBeNull();
  });
});

describe('WorkRunLookup, reading how a run reasoned and what it changed', () => {
  const step = (over: Partial<JournalStep>): JournalStep => ({
    kind: 'tool',
    text: '',
    status: null,
    tool: null,
    detail: null,
    ms: 0,
    startedAt: new Date('2026-09-21T10:00:00.000Z'),
    locations: [],
    input: null,
    output: null,
    change: null,
    ...over,
  });

  const edited = (path: string) =>
    step({ change: { path, before: 'a', after: 'b' } });

  const journalOf = (steps: readonly JournalStep[]) =>
    ({ runId: 'run_1', steps }) as unknown as RunJournal;

  it('offers the messages, thoughts and plans of the agent, where it is in the journal', async () => {
    const reasoned = await lookingUp({
      for: { kind: 'chat', chatId: ChatId.of('chat_1') },
      journal: journalOf([
        step({ kind: 'planned', text: '[pending] Retry uploads' }),
        step({ kind: 'tool', text: 'Edit uploads.ts' }),
        step({ kind: 'thought', text: 'A queue needs a worker.' }),
        step({ kind: 'message', text: 'Retrying in the request.' }),
      ]),
    }).reasoning(RUN);

    expect(reasoned?.steps.map((each) => [each.index, each.kind])).toEqual([
      [0, 'planned'],
      [2, 'thought'],
      [3, 'message'],
    ]);
  });

  it('names the files earlier runs of the task changed too', async () => {
    const reasoned = await lookingUp({
      journal: journalOf([edited('/runs/run_2/api/src/uploads.ts')]),
      changesOfTask: [
        {
          runId: 'run_0',
          checkouts: ['docs'],
          paths: ['/runs/run_0/docs/a.md'],
        },
        {
          runId: 'run_1',
          checkouts: ['api'],
          paths: ['/runs/run_1/api/src/uploads.ts'],
        },
      ],
    }).reasoning(RUN);

    expect(reasoned?.changed).toEqual(['docs/a.md', 'api/src/uploads.ts']);
  });

  it('names each file the run changed once, in the repository it lies in', async () => {
    const changed = await new WorkRunLookup(
      { of: async () => [factsOf()] } as unknown as RunFactsPort,
      {} as RunLeasesPort,
      {
        of: async () => ({
          runId: RUN,
          for: taskAt('implementation'),
          briefedMemories: { briefed: [], omitted: [] },
        }),
      } as unknown as DispatchedRunsPort,
      { find: async () => null } as unknown as TaskRepository,
      {} as ChatRepository,
      {
        findByStation: async () => ({
          repositories: { all: [API, WEB] },
        }),
      } as unknown as LineMapsPort,
      {
        ofRun: async () =>
          journalOf([
            edited('/runs/run_1/api/src/uploads.ts'),
            edited('/runs/run_1/api/src/uploads.ts'),
            edited('/runs/run_1/web/src/Upload.tsx'),
            edited('/tmp/scratch.ts'),
          ]),
      } as unknown as RunJournalReaderPort,
      runJournalReadings(),
    ).changedBy(RUN);

    expect(changed?.map((each) => [each.repository.value, each.path])).toEqual([
      ['acme/api', 'src/uploads.ts'],
      ['acme/web', 'src/Upload.tsx'],
    ]);
  });
});
