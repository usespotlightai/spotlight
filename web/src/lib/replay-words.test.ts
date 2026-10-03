import { describe, expect, it } from 'vitest';
import type { EntryReasonResponseDto } from '@/lib/api';
import {
  checksShown,
  copiesSucceededShown,
  failureShown,
  flippedShown,
  gainRangeShown,
  gainShown,
  healthReadingsOf,
  intervalShown,
  minGainShown,
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
  it('counts what nobody priced in runs and model calls', () => {
    expect(unpricedRunsShown(1)).toBe('1 run');
    expect(unpricedRunsShown(2)).toBe('2 runs');
    expect(unpricedCallsShown(1)).toBe('1 model call');
    expect(unpricedCallsShown(3)).toBe('3 model calls');
  });

  it('says why a run cannot be replayed in plain words', () => {
    expect(refusalShown('archive-gone')).toBe(
      'The workspace it started from is no longer kept',
    );
    expect(refusalShown('unchecked')).toBe('It could not be checked just now');
  });

  it('says a run with no refusal can be replayed', () => {
    expect(replayableShown(null)).toBe('Can be replayed');
    expect(replayableShown('task-gone')).toBe('Its task was deleted');
  });

  it('names over budget as such, and says what it means', () => {
    expect(stateShown('over-budget')).toBe('Over budget');
    expect(stateNote('over-budget')).toBe(
      'It spent its ceiling, so nothing more starts',
    );
    expect(stateNote('finished')).toBeNull();
  });

  it('turns a refusal named as a reason’s detail into words', () => {
    expect(reasonShown(reason('unreplayable', 'task-gone'))).toBe(
      'It could not be replayed or started: its task was deleted',
    );
  });

  it('turns a run failure code into words, and keeps a sentence it does not know', () => {
    expect(reasonShown(reason('run-failed', 'runner-lost'))).toBe(
      'The run failed: the runner was lost, so it goes unscored',
    );
    expect(failureShown('The agent stopped answering')).toBe(
      'The agent stopped answering',
    );
  });

  it('says why checks were skipped, and where they failed', () => {
    expect(reasonShown(reason('check-skipped', 'out-of-time'))).toBe(
      'Its checks could not run: the checks ran out of time',
    );
    expect(
      checksShown({ state: 'failed', failedAt: ['npm test'], why: null }),
    ).toBe('Checks failed at npm test');
    expect(
      checksShown({ state: 'unchecked', failedAt: [], why: 'undrafted' }),
    ).toBe('Unchecked: its change was never drafted');
  });

  it('says why the judge could not judge', () => {
    expect(reasonShown(reason('unjudged', 'ungrounded'))).toBe(
      'The judge could not judge it: the judge cited nothing the run did',
    );
  });

  it('keeps what the judge said as it was said', () => {
    expect(reasonShown(reason('judged', 'Drained the queue.'))).toBe(
      'The judge passed it: Drained the queue.',
    );
    expect(reasonShown(reason('nothing-judges'))).toBe(
      'Neither checks nor a judge score this station',
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
      ['opus, high effort did not do clearly better', 'bad'],
    ]);
    expect(readings[0]?.advice).toBe(
      'More than the +5 pts the line counts as real, so one copy can’t tell a real gain from chance. Search with each run replayed more times, or raise the line’s min_gain.',
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
      'The live replay it was compared with was stopped, so this can’t be compared. Try the stronger model again.',
    );
    expect(readingOf('over-budget')?.advice).toMatch(/ran over its ceiling/);
    expect(readingOf('gone')?.advice).toMatch(
      /^The live replay it was compared with is gone/,
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
});
