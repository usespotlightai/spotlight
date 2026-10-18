import { endOf, measuresOf } from '@replays/domain/replays.fake-spec';
import {
  type EntryFacts,
  resultOf,
} from '@replays/domain/services/entry-result';
import { FAILURE_BLAME } from '@replays/domain/services/failure-blame';
import {
  ChangeChecks,
  type StackStatus,
} from '@replays/domain/value-objects/change-checks.vo';
import { EntryJudging } from '@replays/domain/value-objects/entry-judging.vo';
import { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { RUN_FAILURE_CODES } from '@shared-kernel/domain/value-objects/run-failure-code';
import { describe, expect, it } from 'vitest';

const stack = (
  state: StackStatus['state'],
  more: Partial<StackStatus> = {},
): StackStatus => ({
  repository: 'api',
  state,
  skip: null,
  failedAt: [],
  spent: ModelSpent.of([], 0),
  ...more,
});

const JUDGED = { judges: true, checks: true };

const UNJUDGED = { judges: false, checks: true };

const completed = (more: Partial<EntryFacts> = {}): EntryFacts => ({
  unreplayableReason: null,
  notRun: false,
  end: endOf('completed'),
  measures: measuresOf(1),
  checks: ChangeChecks.of([stack('passed')]),
  judging: null,
  ...more,
});

const verdict = (scale: 'yes-no' | 'number', value: number) =>
  EntryJudging.judged(
    JudgeVerdict.of({
      scale,
      value,
      claimResults: null,
      claims: [],
      passThreshold: 1,
      model: 'judge/model',
      referenced: false,
      reasons: [
        {
          text: 'It drops a job.',
          steps: [4],
          hunks: ['api/q.ts#1'],
          claim: null,
        },
      ],
    }),
  );

describe('whether a replayed task succeeded', () => {
  it('succeeds when its candidate’s own checks pass, and there is no judge', () => {
    expect(resultOf(completed(), UNJUDGED)).toEqual({
      succeeded: true,
      reasons: [],
      concluded: true,
    });
  });

  it('fails when a check fails, naming what failed', () => {
    const result = resultOf(
      completed({
        checks: ChangeChecks.of([
          stack('failed', { failedAt: ['the whole change'] }),
        ]),
      }),
      UNJUDGED,
    );

    expect(result.succeeded).toBe(false);
    expect(result.reasons).toEqual([
      {
        code: 'check-failed',
        detail: 'the whole change',
        steps: [],
        hunks: [],
      },
    ]);
  });

  it('needs the judge to pass it too, where the candidate has a judge', () => {
    expect(
      resultOf(completed({ judging: verdict('yes-no', 1) }), JUDGED).succeeded,
    ).toBe(true);
    expect(
      resultOf(completed({ judging: verdict('yes-no', 0) }), JUDGED).succeeded,
    ).toBe(false);
  });

  it('passes a number score at four or more', () => {
    expect(
      resultOf(completed({ judging: verdict('number', 4) }), JUDGED).succeeded,
    ).toBe(true);
    expect(
      resultOf(completed({ judging: verdict('number', 3) }), JUDGED),
    ).toMatchObject({
      succeeded: false,
      reasons: [
        {
          code: 'judge-failed',
          detail: 'It drops a job.',
          steps: [4],
          hunks: ['api/q.ts#1'],
        },
      ],
    });
  });

  it('rests on the judge alone when the candidate checks nothing', () => {
    const unchecked = { checks: ChangeChecks.of([]) };
    const judgedOnly = { judges: true, checks: false };

    expect(
      resultOf(
        completed({ ...unchecked, judging: verdict('yes-no', 1) }),
        judgedOnly,
      ).succeeded,
    ).toBe(true);
    expect(
      resultOf(
        completed({
          checks: ChangeChecks.of([stack('unchecked')]),
          judging: verdict('yes-no', 1),
        }),
        judgedOnly,
      ).succeeded,
    ).toBe(true);
    expect(
      resultOf(completed(unchecked), { judges: false, checks: false }),
    ).toMatchObject({
      succeeded: null,
      concluded: true,
      reasons: [{ code: 'nothing-judges' }],
    });
  });

  it('goes unscored when its candidate checks changes and no stack of its change arrived at Spotlight, whatever the judge says', () => {
    const result = resultOf(
      completed({
        checks: ChangeChecks.of([]),
        judging: verdict('yes-no', 1),
      }),
      JUDGED,
    );

    expect(result).toMatchObject({
      succeeded: null,
      concluded: true,
      reasons: [{ code: 'no-change-stack' }, { code: 'judged' }],
    });
  });

  it('goes unscored when it changed nothing for its candidate’s check to run on, recording what the judge said', () => {
    const result = resultOf(
      completed({
        checks: ChangeChecks.of([]),
        measures: measuresOf(1, 60_000, 10, 'USD', 0),
        judging: verdict('yes-no', 0),
      }),
      JUDGED,
    );

    expect(result).toMatchObject({
      succeeded: false,
      reasons: [{ code: 'no-change' }, { code: 'judge-failed' }],
    });
    expect(
      resultOf(
        completed({
          checks: ChangeChecks.of([]),
          measures: measuresOf(1, 60_000, 10, 'USD', 0),
        }),
        UNJUDGED,
      ),
    ).toMatchObject({
      succeeded: null,
      concluded: true,
      reasons: [{ code: 'no-change' }],
    });
  });

  it('goes unscored when its candidate checks changes but none of its stacks requested a check', () => {
    expect(
      resultOf(
        completed({ checks: ChangeChecks.of([stack('unchecked')]) }),
        UNJUDGED,
      ),
    ).toMatchObject({
      succeeded: null,
      concluded: true,
      reasons: [{ code: 'check-skipped', detail: 'no-check-asked' }],
    });
  });

  it('waits for its usage to tell a missing stack from no change at all', () => {
    expect(
      resultOf(
        completed({ checks: ChangeChecks.of([]), measures: null }),
        UNJUDGED,
      ).concluded,
    ).toBe(false);
  });

  it('is pending while checks or the judge are still to come, even once something failed', () => {
    expect(
      resultOf(
        completed({ checks: ChangeChecks.of([stack('checking')]) }),
        UNJUDGED,
      ),
    ).toMatchObject({ succeeded: null, concluded: false });
    expect(
      resultOf(
        completed({
          checks: ChangeChecks.of([stack('failed')]),
          judging: EntryJudging.requested(),
        }),
        JUDGED,
      ),
    ).toMatchObject({ succeeded: null, concluded: false });
    expect(resultOf(completed({ checks: null }), UNJUDGED).concluded).toBe(
      false,
    );
  });

  it('goes unscored, saying why, when nobody checked it or the judge could not judge it', () => {
    expect(
      resultOf(
        completed({
          checks: ChangeChecks.of([
            stack('skipped', { skip: 'queue-timeout' }),
          ]),
        }),
        UNJUDGED,
      ),
    ).toEqual({
      succeeded: null,
      concluded: true,
      reasons: [
        {
          code: 'check-skipped',
          detail: 'queue-timeout',
          steps: [],
          hunks: [],
        },
      ],
    });
    expect(
      resultOf(
        completed({ judging: EntryJudging.failed('interrupted') }),
        JUDGED,
      ),
    ).toMatchObject({
      succeeded: null,
      concluded: true,
      reasons: [{ code: 'unjudged', detail: 'interrupted' }],
    });
  });

  it('fails a run that failed on its own or asked a person', () => {
    for (const [end, code] of [
      [endOf('failed'), 'run-failed'],
      [endOf('completed', { asked: true }), 'asked-a-person'],
    ] as const) {
      expect(resultOf(completed({ end }), JUDGED)).toMatchObject({
        succeeded: false,
        concluded: true,
        reasons: [{ code }],
      });
    }
  });

  it('leaves unscored a run that failed for want of a runner rather than through the candidate', () => {
    for (const [failure, succeeded] of [
      ['exited', false],
      ['refused', false],
      [null, false],
      ['unprepared', null],
      ['unprovisioned', null],
      ['hooks-unanswered', null],
      ['runner-lost', null],
      ['superseded', null],
    ] as const) {
      expect(
        resultOf(completed({ end: endOf('failed', { failure }) }), JUDGED),
        String(failure),
      ).toMatchObject({
        succeeded,
        concluded: true,
        reasons: [{ code: 'run-failed', detail: failure }],
      });
    }
  });

  it('blames an exhausted run on the candidate only when it hung past its time', () => {
    for (const [failure, succeeded] of [
      ['runner-lost', null],
      [null, null],
      ['timed-out', false],
    ] as const) {
      expect(
        resultOf(completed({ end: endOf('exhausted', { failure }) }), JUDGED),
        String(failure),
      ).toMatchObject({ succeeded, concluded: true });
    }
  });

  it('blames every way a run can fail on the candidate or on what ran it', () => {
    expect(Object.keys(FAILURE_BLAME).sort()).toEqual(
      [...RUN_FAILURE_CODES].sort(),
    );
  });

  it('leaves unscored a run its replay stopped, and one that could not be replayed or started, saying why', () => {
    expect(
      resultOf(
        completed({ end: endOf('completed', { stopped: true }) }),
        JUDGED,
      ),
    ).toMatchObject({
      succeeded: null,
      concluded: true,
      reasons: [{ code: 'run-stopped' }],
    });

    for (const reason of [
      'archive-gone',
      'candidate-unfit',
      'dispatch-failed',
      'unchecked',
    ] as const) {
      expect(
        resultOf(completed({ unreplayableReason: reason, end: null }), JUDGED),
      ).toMatchObject({
        succeeded: null,
        concluded: true,
        reasons: [{ code: 'unreplayable', detail: reason }],
      });
    }
  });

  it('leaves an entry that never ran unscored', () => {
    expect(
      resultOf(completed({ notRun: true, end: null }), JUDGED),
    ).toMatchObject({ succeeded: null, reasons: [{ code: 'not-run' }] });
  });
});
