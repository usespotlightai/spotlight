import type {
  JournalStep,
  RunJournal,
} from '@runs/application/contracts/run-journal.contract';
import type { RunFacts } from '@runs/application/ports/run-facts.port';
import type {
  LeasedRunFacts,
  RunLeasesPort,
} from '@runs/application/ports/run-leases.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { DispatchedFor } from '@work/application/ports/dispatched-runs.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import { cannedJournalReadings as runJournalReadings } from '@work/application/ports/runs.fake-spec';
import { WorkRunLookup } from '@work/application/services/work-run-lookup.service';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
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
  partial<RunFacts>({
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
  });

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
  readonly attempts?: readonly RunJournal[];
}

const ORDERED_AT = new Date('2026-09-30T09:00:00.000Z');

const WEB = Repository.of('acme/web');

const WORKING_COPIES: Readonly<Record<string, string>> = {
  '/runs/run_0/docs/a.md': 'docs/a.md',
  '/runs/run_1/api/src/uploads.ts': 'api/src/uploads.ts',
  '/runs/run_2/api/src/uploads.ts': 'api/src/uploads.ts',
  '/runs/run_1/web/src/Upload.tsx': 'web/src/Upload.tsx',
  '/runs/run_1/api/src/queue.ts': 'api/src/queue.ts',
};

const readings = runJournalReadings({
  workingCopyPathsIn: (changed) =>
    changed.paths.flatMap((path) => WORKING_COPIES[path] ?? []),
});

const lookingUp = (seen: Seen) => {
  const facts = seen.facts === undefined ? factsOf() : seen.facts;

  return new WorkRunLookup(
    { of: () => Promise.resolve(facts ? [facts] : []) },
    partial<RunLeasesPort>({
      leasedBy: () =>
        Promise.resolve(
          seen.leased === true && facts
            ? partial<LeasedRunFacts>({
                ...facts,
                claimedBy: RUNNER,
                manifest: [],
                pins: [],
              })
            : null,
        ),
    }),
    {
      of: () =>
        Promise.resolve(
          seen.for === null
            ? null
            : {
                runId: RUN,
                for: seen.for ?? taskAt('implementation'),
                briefedMemories: { briefed: [], omitted: [] },
                orderedAt: ORDERED_AT,
              },
        ),
    },
    partial<TaskRepository>({ find: () => Promise.resolve(null) }),
    partial<ChatRepository>({
      find: () =>
        Promise.resolve(partial<Chat>({ teamId: TEAM, repositories: [WEB] })),
    }),
    partial<LineMapsPort>({
      findByStation: () =>
        Promise.resolve(seen.lineGone === true ? null : line),
    }),
    partial<RunJournalReaderPort>({
      attemptsOfRun: () => Promise.resolve([...(seen.attempts ?? [])]),
    }),
    readings,
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

  it('says when the run was ordered, and nothing for a run Work did not dispatch', async () => {
    expect((await runAt('implementation'))?.orderedAt).toEqual(ORDERED_AT);
    expect((await lookingUp({ for: null }).run(RUN))?.orderedAt).toBeNull();
  });

  it('says the run works as its facts say', async () => {
    expect((await runAt('implementation', { working: true }))?.working).toBe(
      true,
    );
    expect((await runAt('implementation', { working: false }))?.working).toBe(
      false,
    );
  });

  it('says which attempt of the run it looked up', async () => {
    expect((await runAt('implementation', { attempt: 3 }))?.attempt).toBe(3);
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

describe('WorkRunLookup, reading how a run reasoned', () => {
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

  const journalOf = (steps: readonly JournalStep[], attempt = 1) =>
    partial<RunJournal>({ runId: 'run_1', attempt, steps });

  it('offers the messages, thoughts and plans of the agent, where it is in the journal', async () => {
    const reasoned = await lookingUp({
      for: { kind: 'chat', chatId: ChatId.of('chat_1') },
      attempts: [
        journalOf([
          step({ kind: 'planned', text: '[pending] Retry uploads' }),
          step({ kind: 'tool', text: 'Edit uploads.ts' }),
          step({ kind: 'thought', text: 'A queue needs a worker.' }),
          step({ kind: 'message', text: 'Retrying in the request.' }),
        ]),
      ],
    }).reasoning(RUN, 1);

    expect(reasoned?.steps.map((each) => [each.index, each.kind])).toEqual([
      [0, 'planned'],
      [2, 'thought'],
      [3, 'message'],
    ]);
  });

  it('reads every attempt of a kept run up to the turn asked about, numbering each attempt’s steps apart so a later step of one attempt moves none of the next', async () => {
    const attempts = [
      journalOf(
        [
          step({ kind: 'message', text: 'Shall I retry uploads?' }),
          step({ kind: 'thought', text: 'The person wants a queue.' }),
        ],
        2,
      ),
      journalOf([step({ kind: 'thought', text: 'Uploads fail.' })], 1),
      journalOf([step({ kind: 'message', text: 'Queue added.' })], 3),
    ];
    const reasonedThrough = async (attempt: number | null) =>
      (
        await lookingUp({
          for: { kind: 'chat', chatId: ChatId.of('chat_1') },
          attempts,
        }).reasoning(RUN, attempt)
      )?.steps.map((each) => [each.index, each.text]);

    expect(await reasonedThrough(2)).toEqual([
      [0, 'Uploads fail.'],
      [1_000_000, 'Shall I retry uploads?'],
      [1_000_001, 'The person wants a queue.'],
    ]);
    expect(await reasonedThrough(null)).toEqual([
      [0, 'Uploads fail.'],
      [1_000_000, 'Shall I retry uploads?'],
      [1_000_001, 'The person wants a queue.'],
      [2_000_000, 'Queue added.'],
    ]);
  });

  it('knows no reasoning for a run with no journal yet', async () => {
    expect(await lookingUp({ attempts: [] }).reasoning(RUN, 1)).toBeNull();
  });
});
