import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { RunJournal } from '@work/application/contracts/run-journal.contract';
import { connectionsInMemory } from '@work/application/ports/run-connections.fake-spec';
import type {
  RunOutcomeShape,
  RunOutcomesPort,
} from '@work/application/ports/run-outcomes.port';
import type { RunUsageReaderPort } from '@work/application/ports/run-usage-reader.port';
import type {
  KeyedStation,
  StationRunReaderPort,
  StationRunRow,
  StationRunsWanted,
} from '@work/application/ports/station-run-reader.port';
import type { TraceScope } from '@work/application/ports/trace-scopes.port';
import { ReadRunnerHistoryHandler } from '@work/application/queries/handlers/read-runner-history.handler';
import {
  type HistoryWanted,
  ReadRunnerHistoryQuery,
} from '@work/application/queries/read-runner-history.query';
import { historyAccessesOf } from '@work/application/services/history-accesses.fake-spec';
import { StationRunHistories } from '@work/application/services/station-run-histories.service';
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
      input: 'npm test',
      output: '3 failing',
      change: { path: 'src/queue.ts', before: 'old', after: 'new' },
    },
  ],
  spans: [],
  ms: 300_000,
  marks: {
    startedAt: null,
    readyAt: null,
    firstAgentUpdateAt: null,
    lastAgentUpdateAt: null,
    agentStoppedAt: null,
    endedAt: null,
  },
  spent: null,
  egressEnforcement: null,
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
  visit: 1,
  checks: null,
  firstHumanAction: null,
  pullRequestState: null,
});

const reading = ({
  team = 'team_1',
  keyed = [IMPLEMENTATION],
  runs = [ran('run_3'), ran('run_2'), ran('run_1')],
  outcomes = [] as RunOutcomeShape[],
  replaysFrom,
  scope,
  among = [],
}: {
  team?: string | null;
  replaysFrom?: Date | null;
  keyed?: KeyedStation[];
  runs?: StationRunRow[];
  outcomes?: RunOutcomeShape[];
  scope?: TraceScope | null;
  among?: StationRunRow[];
} = {}) => {
  const requested: StationRunsWanted[] = [];
  const stationsKeyed = vi.fn().mockResolvedValue(keyed);
  const stations: StationRunReaderPort = {
    unfinishedOfTeam: async () => [],
    traced: async () => ({ tasks: [], stations: [], notes: new Map() }),
    endedRun: vi.fn(),
    configsNamed: async (fingerprints) =>
      fingerprints.map((fingerprint) => ({ fingerprint, parts: PARTS })),
    stationsKeyed,
    endedAt: async (_station, wanted) => {
      requested.push(wanted);
      return runs.slice(0, wanted.max);
    },
    endedAmong: async (_station, runIds) =>
      among.filter((each) => runIds.includes(each.runId)),
    journalsOf: async (ids) => ids.map(journal),
  };
  const outcomesPort: RunOutcomesPort = {
    of: async () => new Map(outcomes.map((each) => [each.runId, each])),
  };

  const usages: RunUsageReaderPort = {
    forRuns: async (ids) =>
      new Map(
        ids.map((id) => [
          id.value,
          {
            ms: 300_000,
            steps: 12,
            errors: 1,
            changedLines: 0,
            contextTokens: 40_000,
            contextWindow: 200_000,
            cost: Money.of(0.42, 'USD'),
            tokens: Tokens.UNREPORTED,
          },
        ]),
      ),
  };

  return {
    requested,
    stationsKeyed,
    read: (wanted: Partial<HistoryWanted> = {}) =>
      new ReadRunnerHistoryHandler(
        historyAccessesOf({
          team,
          ...(replaysFrom === undefined ? {} : { trialAsOf: replaysFrom }),
          ...(scope === undefined ? {} : { scope }),
        }),
        stations,
        outcomesPort,
        usages,
        new StationRunHistories(stations, usages, connectionsInMemory()),
      ).execute(
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
  it('answers nothing for a run its runner does not lease', async () => {
    expect(await reading({ team: null }).read()).toEqual({ kind: 'unknown' });
  });

  it('looks for the station only among the lines of the team of the leased run', async () => {
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

  it('requests the line when several lines have a station by that key', async () => {
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
    expect(run?.outcome?.usage).toEqual({
      ms: 300_000,
      steps: 12,
      errors: 1,
      contextTokens: 40_000,
      cost: 0.42,
      currency: 'USD',
    });
    expect(run?.changes).toEqual([
      { path: 'src/queue.ts', before: 'old', after: 'new', omitted: false },
    ]);
    expect(JSON.stringify(run?.trace)).toContain('3 failing');
  });

  it('reads the last runs requested, and looks further back for an outcome', async () => {
    const plain = reading();

    await plain.read({ last: 2 });

    expect(plain.requested[0]?.max).toBe(2);

    const matching = reading({
      outcomes: [
        outcomeOf('run_3', 'completed'),
        outcomeOf('run_2', 'failed'),
        outcomeOf('run_1', 'failed'),
      ],
    });
    const answer = await matching.read({ outcome: 'failed', last: 1 });

    expect(matching.requested[0]?.max).toBe(500);
    expect(
      answer.kind === 'found' && answer.history.runs.map((each) => each.runId),
    ).toEqual(['run_2']);
  });

  it('shows a trial only the runs that ended before the run it tries again started', async () => {
    const started = new Date('2026-09-20T00:00:00Z');
    const history = reading({ replaysFrom: started });

    await history.read();

    expect(history.requested[0]?.until).toEqual(started);
  });

  it('shows a task run every ended run', async () => {
    const history = reading();

    await history.read();

    expect(history.requested[0]?.until).toBeNull();
  });

  describe('for a search run', () => {
    const SCOPE: TraceScope = {
      stationId: 'station_1',
      hiddenTaskIds: ['task_of_run_2'],
      shownRunIds: ['run_1', 'run_9'],
    };

    it('reads only the searched station, never another by the same key', async () => {
      expect(
        await reading({
          scope: SCOPE,
          keyed: [{ ...IMPLEMENTATION, stationId: 'station_other' }],
        }).read(),
      ).toEqual({ kind: 'unknown' });
      expect(
        (
          await reading({
            scope: SCOPE,
            keyed: [
              IMPLEMENTATION,
              { ...IMPLEMENTATION, stationId: 'station_other', lineKey: 'x' },
            ],
          }).read()
        ).kind,
      ).toBe('found');
    });

    it('leaves out every run of a held-out task, telling the store to skip them too', async () => {
      const history = reading({ scope: SCOPE });
      const answer = await history.read();

      expect(history.requested[0]?.excluding).toEqual(['task_of_run_2']);
      expect(
        answer.kind === 'found' &&
          answer.history.runs.map((each) => each.taskId),
      ).not.toContain('task_of_run_2');
    });

    it('always shows the originals it searches, even beyond the runs requested', async () => {
      const answer = await reading({
        scope: SCOPE,
        among: [ran('run_9')],
      }).read({ last: 1 });

      expect(
        answer.kind === 'found' &&
          answer.history.runs.map((each) => each.runId),
      ).toEqual(['run_3', 'run_9']);
    });

    it('answers nothing rather than an unfiltered history when the search cannot be seen', async () => {
      expect(await reading({ scope: null }).read()).toEqual({
        kind: 'unknown',
      });
    });
  });

  it('skips nothing for a run that acts beyond itself', async () => {
    const history = reading();

    await history.read();

    expect(history.requested[0]?.excluding).toEqual([]);
  });
});
