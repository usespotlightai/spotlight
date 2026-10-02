import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { RunJournal } from '@work/application/contracts/run-journal.contract';
import type { RunDigestReaderPort } from '@work/application/ports/run-digest-reader.port';
import type {
  RunOutcomeShape,
  RunOutcomesPort,
} from '@work/application/ports/run-outcomes.port';
import type { RunnerTraceReaderPort } from '@work/application/ports/runner-trace-reader.port';
import type {
  KeyedStation,
  StationRunReaderPort,
  StationRunRow,
  StationRunsWanted,
} from '@work/application/ports/station-run-reader.port';
import { ReadRunnerHistoryHandler } from '@work/application/queries/handlers/read-runner-history.handler';
import {
  type HistoryWanted,
  ReadRunnerHistoryQuery,
} from '@work/application/queries/read-runner-history.query';
import { Money } from '@work/domain/value-objects/money.vo';
import type { StationConfigParts } from '@work/domain/value-objects/station-config.vo';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import { describe, expect, it, vi } from 'vitest';

const FP = 'a'.repeat(64);

const PARTS: StationConfigParts = {
  prompt: 'Implement it.',
  harness: 'claude-code',
  model: null,
  effort: null,
  profile: null,
  image: null,
  repositories: [],
  skills: [],
  tools: [],
  decisions: false,
  memories: false,
};

const IMPLEMENTATION: KeyedStation = {
  stationId: 'station_1',
  stationKey: 'implementation',
  stationName: 'Implementation',
  lineKey: 'delivery',
  lineName: 'Delivery',
};

const ran = (runId: string): StationRunRow => ({
  runId,
  taskId: `task_of_${runId}`,
  title: `Task of ${runId}`,
  fingerprint: FP,
  state: 'completed',
  attempt: 1,
  harness: 'claude-code',
  startedAt: new Date('2026-09-30T10:00:00Z'),
  endedAt: new Date('2026-09-30T10:05:00Z'),
});

const journal = (runId: string): RunJournal => ({
  runId,
  attempt: 1,
  steps: [
    {
      kind: 'tool',
      text: 'Run the tests',
      status: 'completed',
      tool: 'execute',
      detail: null,
      ms: 1000,
      startedAt: new Date('2026-09-30T10:01:00Z'),
      locations: [],
      given: 'npm test',
      returned: '3 failing',
      change: { path: 'src/queue.ts', before: 'old', after: 'new' },
    },
  ],
  spans: [],
  ms: 300_000,
  marks: {
    startedAt: null,
    readyAt: null,
    spokeFrom: null,
    spokeTo: null,
    endedAt: null,
  },
  spent: null,
});

const outcomeOf = (
  runId: string,
  ending: RunOutcomeShape['ending'],
): RunOutcomeShape => ({
  runId,
  fingerprint: FP,
  endedAt: '2026-09-30T10:05:00.000Z',
  ending,
  failure: null,
  round: 1,
  checks: null,
  next: null,
  delivery: null,
});

const reading = ({
  team = TeamId.of('team_1'),
  keyed = [IMPLEMENTATION],
  runs = [ran('run_3'), ran('run_2'), ran('run_1')],
  outcomes = [] as RunOutcomeShape[],
  replaysFrom = null,
}: {
  team?: TeamId | null;
  replaysFrom?: Date | null;
  keyed?: KeyedStation[];
  runs?: StationRunRow[];
  outcomes?: RunOutcomeShape[];
} = {}) => {
  const asked: StationRunsWanted[] = [];
  const stationsKeyed = vi.fn().mockResolvedValue(keyed);
  const stations: StationRunReaderPort = {
    endedRun: vi.fn(),
    configsNamed: async (fingerprints) =>
      fingerprints.map((fingerprint) => ({ fingerprint, parts: PARTS })),
    stationsKeyed,
    endedAt: async (_station, wanted) => {
      asked.push(wanted);
      return runs.slice(0, wanted.most);
    },
    journalsOf: async (ids) => ids.map(journal),
    alertsAt: async () => null,
  };
  const traces = {
    heldRunStanding: vi
      .fn()
      .mockResolvedValue(team ? { teamId: team, replaysFrom } : null),
  } as unknown as RunnerTraceReaderPort;
  const told: RunOutcomesPort = {
    of: async () => new Map(outcomes.map((each) => [each.runId, each])),
  };

  const digests: RunDigestReaderPort = {
    forRuns: async (ids) =>
      new Map(
        ids.map((id) => [
          id.value,
          {
            ms: 300_000,
            steps: 12,
            faults: 1,
            changedLines: 0,
            used: 40_000,
            size: 200_000,
            cost: Money.of(0.42, 'USD'),
            tokens: Tokens.UNREPORTED,
          },
        ]),
      ),
  };

  return {
    asked,
    stationsKeyed,
    read: (wanted: Partial<HistoryWanted> = {}) =>
      new ReadRunnerHistoryHandler(traces, stations, told, digests).execute(
        new ReadRunnerHistoryQuery('run_0', 'runner_1', {
          station: 'implementation',
          line: null,
          fingerprint: null,
          outcome: null,
          since: null,
          last: null,
          ...wanted,
        }),
      ),
  };
};

describe('ReadRunnerHistoryHandler', () => {
  it('answers nothing for a run its runner does not hold', async () => {
    expect(await reading({ team: null }).read()).toEqual({ kind: 'unknown' });
  });

  it('looks for the station only among the held run’s team’s lines', async () => {
    const { read, stationsKeyed } = reading();

    await read({ line: 'delivery' });

    expect(stationsKeyed).toHaveBeenCalledWith(
      TeamId.of('team_1'),
      'implementation',
      'delivery',
    );
  });

  it('answers nothing for a station the team has no line with', async () => {
    expect(await reading({ keyed: [] }).read()).toEqual({ kind: 'unknown' });
  });

  it('asks for the line when several lines have a station by that key', async () => {
    expect(
      await reading({
        keyed: [IMPLEMENTATION, { ...IMPLEMENTATION, lineKey: 'hotfix' }],
      }).read(),
    ).toEqual({ kind: 'ambiguous', lines: ['delivery', 'hotfix'] });
  });

  it('lays out each run with its config, outcome, changes and whole journal', async () => {
    const answer = await reading({
      runs: [ran('run_1')],
      outcomes: [outcomeOf('run_1', 'failed')],
    }).read();

    if (answer.kind !== 'found') {
      throw new Error('expected a history');
    }

    expect(answer.history.station).toEqual({
      key: 'implementation',
      name: 'Implementation',
    });
    expect(answer.history.configs).toEqual([
      { fingerprint: FP, config: PARTS },
    ]);

    const [run] = answer.history.runs;

    expect(run?.outcome?.ending).toBe('failed');
    expect(run?.outcome?.cost).toEqual({
      ms: 300_000,
      steps: 12,
      faults: 1,
      used: 40_000,
      cost: 0.42,
      currency: 'USD',
    });
    expect(run?.changes).toEqual([
      { path: 'src/queue.ts', before: 'old', after: 'new', omitted: false },
    ]);
    expect(JSON.stringify(run?.trace)).toContain('3 failing');
  });

  it('reads the last runs asked for, and searches further back for an outcome', async () => {
    const plain = reading();

    await plain.read({ last: 2 });

    expect(plain.asked[0]?.most).toBe(2);

    const searched = reading({
      outcomes: [
        outcomeOf('run_3', 'completed'),
        outcomeOf('run_2', 'failed'),
        outcomeOf('run_1', 'failed'),
      ],
    });
    const answer = await searched.read({ outcome: 'failed', last: 1 });

    expect(searched.asked[0]?.most).toBe(500);
    expect(
      answer.kind === 'found' && answer.history.runs.map((each) => each.runId),
    ).toEqual(['run_2']);
  });

  it('shows a replay only the runs that ended before the run it replays started', async () => {
    const started = new Date('2026-09-20T00:00:00Z');
    const history = reading({ replaysFrom: started });

    await history.read();

    expect(history.asked[0]?.until).toEqual(started);
  });

  it('shows a task run every ended run', async () => {
    const history = reading();

    await history.read();

    expect(history.asked[0]?.until).toBeNull();
  });
});
