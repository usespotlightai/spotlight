import { describe, expect, it } from 'vitest';
import type { EntryReasonResponseDto } from '@/lib/api';
import {
  checksShown,
  failureShown,
  reasonShown,
  refusalShown,
  replayableShown,
  runStateShown,
  stateNote,
  stateShown,
  uncomparedShown,
  unpricedCallsShown,
  unpricedRunsShown,
} from '@/lib/replay-words';

const reason = (
  code: EntryReasonResponseDto['code'],
  detail: string | null = null,
): EntryReasonResponseDto => ({ code, detail, steps: [], hunks: [] });

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
      'The run failed: runner lost (not scored)',
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
});
