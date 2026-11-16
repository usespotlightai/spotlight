import {
  beatsLiveJudge,
  bestCandidateOf,
  candidateCountWithin,
  type LabelledRun,
  MAX_REVISION_JUDGE_CALLS,
} from '@insights/domain/services/revision-pick';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const run = (id: string, human: boolean, live: boolean): LabelledRun => ({
  runId: RunId.of(id),
  human,
  live,
});

const SPLIT = {
  searched: [
    run('s1', true, false),
    run('s2', false, false),
    run('s3', true, true),
    run('s4', false, true),
  ],
  heldOut: [
    run('h1', true, false),
    run('h2', false, false),
    run('h3', true, true),
    run('h4', false, true),
  ],
};

const humanAnswers = (runs: readonly LabelledRun[]) =>
  new Map(runs.map((each) => [each.runId.value, each.human]));

const flipped = (runs: readonly LabelledRun[]) =>
  new Map(runs.map((each) => [each.runId.value, !each.human]));

describe('bestCandidateOf', () => {
  it('picks the candidate by its agreement on the searched runs, never on the held-out runs', () => {
    const best = bestCandidateOf(SPLIT, [
      {
        claims: ['Fits the held-out runs.'],
        passes: new Map([
          ...flipped(SPLIT.searched),
          ...humanAnswers(SPLIT.heldOut),
        ]),
      },
      {
        claims: ['Fits the searched runs.'],
        passes: new Map([
          ...humanAnswers(SPLIT.searched),
          ...flipped(SPLIT.heldOut),
        ]),
      },
    ]);

    expect(best?.claims).toEqual(['Fits the searched runs.']);
    expect(best?.agreement.searched.after).toBe(1);
    expect(best && beatsLiveJudge(best.agreement)).toBe(false);
  });

  it('picks the candidate with the best searched agreement', () => {
    const best = bestCandidateOf(SPLIT, [
      {
        claims: ['Worse.'],
        passes: flipped([...SPLIT.searched, ...SPLIT.heldOut]),
      },
      {
        claims: ['Better.'],
        passes: humanAnswers([...SPLIT.searched, ...SPLIT.heldOut]),
      },
    ]);

    expect(best?.claims).toEqual(['Better.']);
    expect(best?.agreement.heldOut.after).toBe(1);
    expect(best?.agreement.heldOut.runs).toBe(4);
    expect(best && beatsLiveJudge(best.agreement)).toBe(true);
  });

  it('compares the live judge on the same held-out runs only', () => {
    const passes = humanAnswers([
      ...SPLIT.searched,
      ...SPLIT.heldOut.slice(0, 3),
    ]);
    const best = bestCandidateOf(SPLIT, [{ claims: ['Some.'], passes }]);

    expect(best?.agreement.heldOut.runs).toBe(3);
  });

  it('leaves out a candidate with fewer than 3 judged held-out runs', () => {
    expect(
      bestCandidateOf(SPLIT, [
        {
          claims: ['Few.'],
          passes: humanAnswers([
            ...SPLIT.searched,
            ...SPLIT.heldOut.slice(0, 2),
          ]),
        },
      ]),
    ).toBeNull();
  });
});

describe('beatsLiveJudge', () => {
  it('needs a higher held-out agreement than the live judge', () => {
    const same = { before: 0.4, after: 0.4, runs: 10 };

    expect(beatsLiveJudge({ searched: same, heldOut: same })).toBe(false);
    expect(
      beatsLiveJudge({
        searched: same,
        heldOut: { before: null, after: 0.1, runs: 10 },
      }),
    ).toBe(true);
    expect(
      beatsLiveJudge({
        searched: same,
        heldOut: { before: 0.1, after: null, runs: 10 },
      }),
    ).toBe(false);
  });
});

describe('candidateCountWithin', () => {
  it('keeps the judge calls under the ceiling', () => {
    expect(candidateCountWithin(50, 3)).toBe(3);
    expect(candidateCountWithin(MAX_REVISION_JUDGE_CALLS, 3)).toBe(1);
    expect(candidateCountWithin(MAX_REVISION_JUDGE_CALLS + 1, 3)).toBe(0);
    expect(candidateCountWithin(0, 3)).toBe(0);
    expect(candidateCountWithin(10, 2)).toBe(2);
  });
});
