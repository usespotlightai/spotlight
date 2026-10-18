import { describe, expect, it } from 'vitest';
import type { EntryReasonResponseDto } from '@/lib/api';
import {
  checksSetOf,
  formatBalanceWarning,
  formatBaselineNote,
  formatChecks,
  formatCopiesSucceeded,
  formatEndedSpan,
  formatFailure,
  formatFlipped,
  formatGain,
  formatGainRange,
  formatInterval,
  formatMinGain,
  formatOrigin,
  formatPair,
  formatPairTally,
  formatPerRepeat,
  formatReason,
  formatRepeats,
  formatReplayable,
  formatRunState,
  formatSpendNote,
  formatState,
  formatTurnedOut,
  formatUncompared,
  formatUnpricedCalls,
  formatUnpricedRuns,
  formatUnreplayableReason,
  healthReadingsOf,
  healthReplayOf,
  type SetHealth,
  stateNote,
} from '@/lib/replay-words';

const reason = (
  code: EntryReasonResponseDto['code'],
  detail: string | null = null,
): EntryReasonResponseDto => ({ code, detail, steps: [], hunks: [] });

const NEVER_READ: SetHealth = {
  noise: null,
  saturation: null,
  judge: null,
  checks: null,
  oracle: null,
};

describe('replay words', () => {
  it('names which change the blind judge found closer to the accepted one', () => {
    expect(formatPair('win', 'the baseline')).toBe('This one');
    expect(formatPair('loss', 'the baseline')).toBe('The baseline');
    expect(formatPair('tie', 'the live config')).toBe('Neither');
    expect(formatPair(null, 'the baseline')).toBe('–');
    expect(formatPairTally({ wins: 2, losses: 1, ties: 1 })).toBe(
      '2 wins, 1 loss, 1 tie',
    );
  });

  it('counts what nobody priced in runs and model calls', () => {
    expect(formatUnpricedRuns(1)).toBe('1 run');
    expect(formatUnpricedRuns(2)).toBe('2 runs');
    expect(formatUnpricedCalls(1)).toBe('1 model call');
    expect(formatUnpricedCalls(3)).toBe('3 model calls');
  });

  it('says why a run cannot be replayed in plain words', () => {
    expect(formatUnreplayableReason('archive-gone')).toBe(
      'Starting workspace is no longer stored',
    );
    expect(formatUnreplayableReason('unchecked')).toBe(
      'Couldn’t be checked just now',
    );
  });

  it('says a run with no unreplayable reason can be replayed', () => {
    expect(formatReplayable(null)).toBe('Can be replayed');
    expect(formatReplayable('task-gone')).toBe('Task was deleted');
  });

  it('names over budget as such, and says what it means', () => {
    expect(formatState('over-budget')).toBe('Over budget');
    expect(stateNote('over-budget')).toBe(
      'The replay reached its ceiling. No more runs start.',
    );
    expect(stateNote('finished')).toBeNull();
  });

  it('turns an unreplayable reason named as a reason’s detail into words', () => {
    expect(formatReason(reason('unreplayable', 'task-gone'))).toBe(
      'Couldn’t be replayed or started: task was deleted',
    );
  });

  it('turns a run failure code into words, and keeps a sentence it does not know', () => {
    expect(formatReason(reason('run-failed', 'runner-lost'))).toBe(
      'Run failed: runner lost (not scored)',
    );
    expect(formatFailure('The agent stopped answering')).toBe(
      'The agent stopped answering',
    );
  });

  it('says why checks were skipped, and where they failed', () => {
    expect(formatReason(reason('check-skipped', 'out-of-time'))).toBe(
      'Checks couldn’t run: checks ran out of time',
    );
    expect(
      formatChecks({ state: 'failed', failedAt: ['npm test'], why: null }),
    ).toBe('Checks failed at npm test');
    expect(
      formatChecks({ state: 'unchecked', failedAt: [], why: 'not-generated' }),
    ).toBe('Unchecked: change not generated');
  });

  it('says why the judge could not judge', () => {
    expect(formatReason(reason('unjudged', 'ungrounded'))).toBe(
      'Judge couldn’t judge it: judge cited nothing the run did',
    );
  });

  it('keeps what the judge said as it was said', () => {
    expect(formatReason(reason('judged', 'Drained the queue.'))).toBe(
      'Judge passed it: Drained the queue.',
    );
    expect(formatReason(reason('nothing-judges'))).toBe(
      'No checks or judge score this station',
    );
  });

  it('says why two scores could not be compared', () => {
    expect(formatUncompared('other-rubric')).toBe(
      'Judged by different rubrics',
    );
  });

  it('names run states it knows, and capitalises those it does not', () => {
    expect(formatRunState('claimed')).toBe('Running');
    expect(formatRunState('rewound')).toBe('Rewound');
  });

  it('shows a likely range and a gain in points', () => {
    expect(formatInterval({ low: 0.48, high: 0.75 })).toBe('48–75%');
    expect(formatGain({ gain: 0.12 })).toBe('+12 pts');
    expect(formatGain({ gain: -0.031 })).toBe('−3 pts');
    expect(formatGain({ gain: 0 })).toBe('0 pts');
    expect(formatGainRange({ low: -0.08, high: 0.15 })).toBe('−8 to +15');
    expect(formatMinGain(0.05)).toBe('+5 pts');
  });

  it('counts copies, repeats and the tasks that went both ways', () => {
    expect(formatCopiesSucceeded(2, 3)).toBe('2 of 3 copies succeeded');
    expect(formatCopiesSucceeded(0, 0)).toBe('No copy scored yet');
    expect(formatRepeats(1)).toBe('Each run once');
    expect(formatRepeats(3)).toBe('Each run 3 times');
    expect(formatFlipped(0)).toBe('No task went both ways');
    expect(formatFlipped(2)).toBe('2 tasks went both ways');
    expect(formatPerRepeat([0.5, 0.625])).toBe('50%, 63%');
  });

  it('says plainly that a set’s health was never read, and how to read it', () => {
    const readings = healthReadingsOf(NEVER_READ, 0.05);

    expect(readings.map((each) => [each.label, each.text, each.tone])).toEqual([
      ['Noise', 'Not measured', 'unknown'],
      ['Room to improve', 'Not measured', 'unknown'],
      ['Judge agreeing with itself', 'Not checked', 'unknown'],
      ['Flaky checks', 'Not checked', 'unknown'],
    ]);
    expect(readings[2]?.advice).toMatch(
      /^The first baseline of the live config judges each change twice/,
    );
  });

  it('takes whether the noise is too wide from the server', () => {
    const [noise] = healthReadingsOf(
      {
        ...NEVER_READ,
        noise: {
          replayId: 'r',
          fingerprint: 'f',
          repeats: 3,
          perRepeat: [0.5, 0.56],
          spread: 0.06,
          flippedTasks: [],
          measuredAt: '2026-10-02T09:00:00.000Z',
          noisyInOneCopy: false,
        },
      },
      0.05,
    );

    expect(noise?.tone).toBe('good');
    expect(noise?.advice).toMatch(/^Noise is within the line’s minimum/);
  });

  it('reads an unhealthy set line by line, each with what to do', () => {
    const readings = healthReadingsOf(
      {
        noise: {
          replayId: 'r',
          fingerprint: 'f',
          repeats: 3,
          perRepeat: [0.5, 0.6, 0.7],
          spread: 0.2,
          flippedTasks: [],
          measuredAt: '2026-10-02T09:00:00.000Z',
          noisyInOneCopy: true,
        },
        saturation: {
          replayId: 'r',
          rate: 0.97,
          interval: null,
          saturated: true,
          measuredAt: '2026-10-02T09:00:00.000Z',
        },
        judge: {
          replayId: 'r',
          compared: 10,
          agreed: 7,
          pending: 2,
          agreement: 0.7,
          unstable: true,
        },
        checks: {
          replayId: 'r',
          rechecked: 12,
          pending: 0,
          flaky: [
            {
              taskId: 't',
              originalRunId: 'o',
              runId: 'n',
              first: 'passed',
              recheck: 'failed',
            },
          ],
        },
        oracle: {
          replayId: 'o',
          candidateId: 'c',
          repeats: 1,
          state: 'finished',
          againstReplayId: 'r',
          againstState: 'finished',
          answered: 6,
          live: 0.95,
          withAnswer: 0.97,
          gain: {
            gain: 0.02,
            low: -0.05,
            high: 0.08,
            verdict: 'within-noise',
            minGain: 0.05,
            tasks: 6,
          },
          roomToImprove: false,
        },
      },
      0.05,
    );

    expect(readings.map((each) => [each.text, each.tone])).toEqual([
      ['Success moved 20 pts between 3 copies', 'bad'],
      ['Little: +2 pts with the answer', 'bad'],
      ['Same verdict on 70% of 10 changes', 'bad'],
      ['1 of 12 changes flipped', 'bad'],
    ]);
    expect(readings[0]?.advice).toBe(
      'One copy can’t tell a real gain from chance. Search with more repeats per run, or raise the line’s min_gain. Minimum real gain: +5 pts',
    );
    expect(readings[1]?.advice).toMatch(
      /^Live config: 95% on 6 runs\. With the answer: 97%\. Even the answer barely helps\./,
    );
    expect(readings[2]?.advice).toMatch(
      /2 second judgings are still to come\.$/,
    );
  });

  it('reads the room a set leaves from the live config handed each run’s answer', () => {
    const oracle: NonNullable<SetHealth['oracle']> = {
      replayId: 'o',
      candidateId: 'c',
      repeats: 1,
      state: 'finished',
      againstReplayId: 'r',
      againstState: 'finished',
      answered: 5,
      live: 0.6,
      withAnswer: 0.8,
      gain: {
        gain: 0.2,
        low: 0.04,
        high: 0.4,
        verdict: 'better',
        minGain: 0.05,
        tasks: 5,
      },
      roomToImprove: true,
    };
    const roomOf = (read: Partial<NonNullable<SetHealth['oracle']>>) =>
      healthReadingsOf(
        { ...NEVER_READ, oracle: { ...oracle, ...read } },
        0.05,
      )[1];

    expect(roomOf({})?.text).toBe('Up to +20 pts with the answer');
    expect(roomOf({})?.tone).toBe('good');
    expect(roomOf({})?.advice).toMatch(
      /^Live config: 60% on 5 runs\. With the answer: 80%\./,
    );
    expect(roomOf({ state: 'running' })?.text).toBe(
      'Measuring with the answer',
    );
    expect(roomOf({ state: 'stopped' })?.text).toBe(
      'Couldn’t measure with the answer',
    );
    expect(roomOf({ againstState: 'gone' })?.tone).toBe('unknown');
    expect(healthReplayOf({ ...NEVER_READ, oracle }, 'saturation')).toBe('o');
  });

  it('names how a run turned out and where its task came from', () => {
    expect(formatTurnedOut('sent-back')).toBe('Sent back');
    expect(formatTurnedOut('asked')).toBe('Asked a person');
    expect(formatOrigin('person')).toBe('A person');
    expect(formatOrigin('station')).toBe('Another station');
    expect(formatOrigin('github')).toBe('GitHub');
    expect(formatOrigin('slack')).toBe('Slack');
    expect(formatOrigin('acme')).toBe('Acme');
  });

  it('warns plainly when one outcome crowds a set', () => {
    expect(
      formatBalanceWarning({ dominant: 'failed', count: 7, entries: 8 }),
    ).toBe(
      '7 of 8 runs failed. Add runs that turned out other ways to balance the set.',
    );
  });

  it('says when a set’s runs ended, and nothing while none has', () => {
    const empty = {
      outcomes: [],
      origins: [],
      oldest: null,
      median: null,
      newest: null,
      balanceWarning: null,
    };
    const at = new Date(Date.now() - 30 * 60_000).toISOString();

    expect(formatEndedSpan(empty)).toBeNull();
    expect(
      formatEndedSpan({ ...empty, oldest: at, median: at, newest: at }),
    ).toBe('Ended 30m ago');
    expect(
      formatEndedSpan({
        ...empty,
        oldest: new Date(Date.now() - 3 * 3_600_000).toISOString(),
        median: new Date(Date.now() - 2 * 3_600_000).toISOString(),
        newest: at,
      }),
    ).toBe('Ended between 3h ago and 30m ago · Median: 2h ago');
  });

  it('says when the first baseline also checks the set, and only for a set of 5 or more runs', () => {
    expect(formatBaselineNote(false, null, 1, true)).toBe(
      'The set has no baseline yet. This replay of the live config becomes the baseline. The first baseline checks the set. It replays each run 3 times with 3 times the ceiling. It judges and checks each change twice.',
    );
    expect(formatBaselineNote(false, null, 1)).not.toMatch(/checks the set/);
    expect(
      checksSetOf({ entries: [1, 2, 3, 4, 5], health: { noise: null } }),
    ).toBe(true);
    expect(checksSetOf({ entries: [1, 2], health: { noise: null } })).toBe(
      false,
    );
    expect(
      checksSetOf({ entries: [1, 2, 3, 4, 5], health: { noise: {} } }),
    ).toBe(false);
  });
});

describe('formatSpendNote', () => {
  const parts = {
    runs: '$2.75',
    drafting: '$0.12',
    judging: '$0.18',
    pairing: null,
    elsewhere: [],
    unpricedRuns: 0,
    unpricedCalls: 0,
    over: false,
  };

  it('says what the spend went on, and nothing more when everything was priced in the ceiling’s currency', () => {
    expect(formatSpendNote(parts)).toBe(
      'Runs $2.75 · Drafting $0.12 · Judging $0.18.',
    );
  });

  it('counts side-by-side judging against the ceiling, not in cost per run', () => {
    expect(formatSpendNote({ ...parts, pairing: '$0.24' })).toBe(
      'Runs $2.75 · Drafting $0.12 · Judging $0.18 · Side by side $0.24. Side-by-side judging counts against the ceiling. It doesn’t add to cost per run.',
    );
  });

  it('names spend in other currencies, what nobody priced, and why runs went over the ceiling', () => {
    expect(
      formatSpendNote({
        ...parts,
        elsewhere: ['€1.00'],
        unpricedRuns: 2,
        unpricedCalls: 1,
        over: true,
      }),
    ).toBe(
      'Runs $2.75 · Drafting $0.12 · Judging $0.18. Runs that are underway at the ceiling still finish. A replay can end slightly over its ceiling. Also spent €1.00. These amounts are in another currency. They don’t count against the ceiling. Not priced: 2 runs · 1 model call.',
    );
  });
});
