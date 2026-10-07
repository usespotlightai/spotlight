import { describe, expect, it } from 'vitest';
import type { EntryReasonResponseDto } from '@/lib/api';
import {
  balanceWarningShown,
  checksShown,
  copiesSucceededShown,
  endedSpanShown,
  failureShown,
  flippedShown,
  gainRangeShown,
  gainShown,
  healthReadingsOf,
  intervalShown,
  minGainShown,
  originShown,
  pairShown,
  pairTallyShown,
  perRepeatShown,
  reasonShown,
  refusalShown,
  repeatsShown,
  replayableShown,
  runStateShown,
  type SetHealth,
  sanityRetryable,
  stateNote,
  stateShown,
  strongerConfigShown,
  turnedOutShown,
  uncomparedShown,
  unpricedCallsShown,
  unpricedRunsShown,
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
  sanity: null,
};

describe('replay words', () => {
  it('names which change the blind judge found closer to the accepted one', () => {
    expect(pairShown('win', 'the baseline')).toBe('This one');
    expect(pairShown('loss', 'the baseline')).toBe('The baseline');
    expect(pairShown('tie', 'the live config')).toBe('Neither');
    expect(pairShown(null, 'the baseline')).toBe('–');
    expect(pairTallyShown({ wins: 2, losses: 1, ties: 1 })).toBe(
      '2 wins, 1 loss, 1 tie',
    );
  });

  it('counts what nobody priced in runs and model calls', () => {
    expect(unpricedRunsShown(1)).toBe('1 run');
    expect(unpricedRunsShown(2)).toBe('2 runs');
    expect(unpricedCallsShown(1)).toBe('1 model call');
    expect(unpricedCallsShown(3)).toBe('3 model calls');
  });

  it('says why a run cannot be replayed in plain words', () => {
    expect(refusalShown('archive-gone')).toBe(
      'Starting workspace is no longer kept',
    );
    expect(refusalShown('unchecked')).toBe('Couldn’t be checked just now');
  });

  it('says a run with no refusal can be replayed', () => {
    expect(replayableShown(null)).toBe('Can be replayed');
    expect(replayableShown('task-gone')).toBe('Task was deleted');
  });

  it('names over budget as such, and says what it means', () => {
    expect(stateShown('over-budget')).toBe('Over budget');
    expect(stateNote('over-budget')).toBe(
      'Ceiling reached. No more runs start.',
    );
    expect(stateNote('finished')).toBeNull();
  });

  it('turns a refusal named as a reason’s detail into words', () => {
    expect(reasonShown(reason('unreplayable', 'task-gone'))).toBe(
      'Couldn’t be replayed or started: task was deleted',
    );
  });

  it('turns a run failure code into words, and keeps a sentence it does not know', () => {
    expect(reasonShown(reason('run-failed', 'runner-lost'))).toBe(
      'Run failed: runner lost (not scored)',
    );
    expect(failureShown('The agent stopped answering')).toBe(
      'The agent stopped answering',
    );
  });

  it('says why checks were skipped, and where they failed', () => {
    expect(reasonShown(reason('check-skipped', 'out-of-time'))).toBe(
      'Checks couldn’t run: checks ran out of time',
    );
    expect(
      checksShown({ state: 'failed', failedAt: ['npm test'], why: null }),
    ).toBe('Checks failed at npm test');
    expect(
      checksShown({ state: 'unchecked', failedAt: [], why: 'undrafted' }),
    ).toBe('Unchecked: change never drafted');
  });

  it('says why the judge could not judge', () => {
    expect(reasonShown(reason('unjudged', 'ungrounded'))).toBe(
      'Judge couldn’t judge it: judge cited nothing the run did',
    );
  });

  it('keeps what the judge said as it was said', () => {
    expect(reasonShown(reason('judged', 'Drained the queue.'))).toBe(
      'Judge passed it: Drained the queue.',
    );
    expect(reasonShown(reason('nothing-judges'))).toBe(
      'No checks or judge score this station',
    );
  });

  it('says why two scores could not be compared', () => {
    expect(uncomparedShown('other-rubric')).toBe('Judged by different rubrics');
  });

  it('names run states it knows, and capitalises those it does not', () => {
    expect(runStateShown('claimed')).toBe('Running');
    expect(runStateShown('rewound')).toBe('Rewound');
  });

  it('shows a likely range and a gain in points', () => {
    expect(intervalShown({ low: 0.48, high: 0.75 })).toBe('48–75%');
    expect(gainShown({ gain: 0.12 })).toBe('+12 pts');
    expect(gainShown({ gain: -0.031 })).toBe('−3 pts');
    expect(gainShown({ gain: 0 })).toBe('0 pts');
    expect(gainRangeShown({ low: -0.08, high: 0.15 })).toBe('−8 to +15');
    expect(minGainShown(0.05)).toBe('+5 pts');
  });

  it('counts copies, repeats and the tasks that went both ways', () => {
    expect(copiesSucceededShown(2, 3)).toBe('2 of 3 copies succeeded');
    expect(copiesSucceededShown(0, 0)).toBe('No copy scored yet');
    expect(repeatsShown(1)).toBe('Each run once');
    expect(repeatsShown(3)).toBe('Each run 3 times');
    expect(flippedShown(0)).toBe('No task went both ways');
    expect(flippedShown(2)).toBe('2 tasks went both ways');
    expect(perRepeatShown([0.5, 0.625])).toBe('50%, 63%');
  });

  it('says plainly that a set’s health was never read, and how to read it', () => {
    const readings = healthReadingsOf(NEVER_READ, 0.05);

    expect(readings.map((each) => [each.label, each.said, each.tone])).toEqual([
      ['Noise', 'Not measured', 'unknown'],
      ['Room to improve', 'Not measured', 'unknown'],
      ['Judge agreeing with itself', 'Not checked', 'unknown'],
      ['Flaky checks', 'Not checked', 'unknown'],
      ['Stronger model', 'Not tried', 'unknown'],
    ]);
    expect(readings[2]?.advice).toMatch(/^Check this set to judge each change/);
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
        sanity: {
          replayId: 's',
          candidateId: 'c',
          model: 'opus',
          effort: 'high',
          repeats: 1,
          state: 'finished',
          againstReplayId: 'r',
          againstState: 'finished',
          gain: null,
          rewardsStrongerModel: false,
          worse: [],
        },
      },
      0.05,
    );

    expect(readings.map((each) => [each.said, each.tone])).toEqual([
      ['Success moved 20 pts between 3 copies', 'bad'],
      ['Almost none: the live config succeeds on 97%', 'bad'],
      ['Same verdict on 70% of 10 changes', 'bad'],
      ['1 of 12 changes flipped', 'bad'],
      ['opus, high effort didn’t do clearly better', 'bad'],
    ]);
    expect(readings[0]?.advice).toBe(
      'One copy can’t tell a real gain from chance. Search with more repeats per run, or raise the line’s min_gain. Minimum real gain: +5 pts',
    );
    expect(readings[1]?.advice).toMatch(
      /Search for the same success at less cost/,
    );
    expect(readings[2]?.advice).toMatch(/2 second judgings still to come\.$/);
  });

  it('says plainly when the live replay a stronger model was compared with never finished', () => {
    const sanity = {
      replayId: 's',
      candidateId: 'c',
      model: 'opus',
      effort: null,
      repeats: 1,
      state: 'finished' as const,
      againstReplayId: 'r',
      gain: null,
      rewardsStrongerModel: null,
      worse: [],
    };
    const readingOf = (
      againstState: NonNullable<SetHealth['sanity']>['againstState'],
    ) =>
      healthReadingsOf(
        { ...NEVER_READ, sanity: { ...sanity, againstState } },
        0.05,
      )[4];

    expect(readingOf('stopped')?.said).toBe('Could not be compared');
    expect(readingOf('stopped')?.advice).toBe(
      'Live replay to compare with was stopped. Try the stronger model again.',
    );
    expect(readingOf('over-budget')?.advice).toMatch(/ran over its ceiling/);
    expect(readingOf('gone')?.advice).toMatch(
      /^Live replay to compare with is gone/,
    );
    expect(readingOf('running')?.said).toBe('Nothing to compare with yet');
    expect(readingOf('running')?.tone).toBe('pending');
    expect(sanityRetryable({ state: 'finished', againstState: 'gone' })).toBe(
      true,
    );
    expect(sanityRetryable({ state: 'stopped', againstState: null })).toBe(
      true,
    );
    expect(
      sanityRetryable({ state: 'finished', againstState: 'running' }),
    ).toBe(false);
  });

  it('names a stronger config by what it changed', () => {
    expect(strongerConfigShown({ model: 'opus', effort: null })).toBe('opus');
    expect(strongerConfigShown({ model: null, effort: 'high' })).toBe(
      'high effort',
    );
    expect(strongerConfigShown({ model: null, effort: null })).toBe(
      'A stronger config',
    );
  });

  it('names how a run turned out and where its task came from', () => {
    expect(turnedOutShown('sent-back')).toBe('Sent back');
    expect(turnedOutShown('asked')).toBe('Asked a person');
    expect(originShown('person')).toBe('A person');
    expect(originShown('station')).toBe('Another station');
    expect(originShown('github')).toBe('GitHub');
    expect(originShown('slack')).toBe('Slack');
    expect(originShown('acme')).toBe('Acme');
  });

  it('warns plainly when one outcome crowds a set', () => {
    expect(
      balanceWarningShown({ dominant: 'failed', count: 7, entries: 8 }),
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

    expect(endedSpanShown(empty)).toBeNull();
    expect(
      endedSpanShown({ ...empty, oldest: at, median: at, newest: at }),
    ).toBe('Ended 30m ago');
    expect(
      endedSpanShown({
        ...empty,
        oldest: new Date(Date.now() - 3 * 3_600_000).toISOString(),
        median: new Date(Date.now() - 2 * 3_600_000).toISOString(),
        newest: at,
      }),
    ).toBe('Ended between 3h ago and 30m ago · Median: 2h ago');
  });
});
