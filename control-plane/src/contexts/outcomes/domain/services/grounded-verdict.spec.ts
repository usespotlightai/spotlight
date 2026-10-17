import { claimsCriteria } from '@outcomes/domain/judging.fake-spec';
import {
  type ClaimVerdict,
  groundedVerdict,
} from '@outcomes/domain/services/grounded-verdict';
import { JudgeEvidence } from '@outcomes/domain/services/judge-evidence';
import { JudgeCriteria } from '@outcomes/domain/value-objects/judge-criteria.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const EVIDENCE = JudgeEvidence.of({
  runId: RunId.of('run_1'),
  title: 'Retry uploads',
  description: null,
  steps: [
    {
      index: 2,
      kind: 'message',
      tool: null,
      text: 'Retrying.',
      given: null,
      returned: null,
    },
  ],
  hunks: [
    {
      id: 'api/up.ts#1',
      path: 'api/up.ts',
      header: '@@ -1 +1 @@',
      lines: ['+retry()'],
    },
  ],
});

const grounded = { text: 'It retries.', steps: [2], hunks: [] };

const ungrounded = { text: 'It tests.', steps: [99], hunks: [] };

const claim = (
  index: number,
  met: boolean,
  reasons = [grounded],
): ClaimVerdict => ({ index, met, reasons });

const allThree = (...claims: ClaimVerdict[]) =>
  groundedVerdict(claimsCriteria(), { claims }, EVIDENCE);

describe('groundedVerdict on claims', () => {
  it('scores the share of claims met, keeping each claim’s mark and naming the claim on every reason', () => {
    const verdict = allThree(claim(2, true), claim(0, true), claim(1, false));

    expect(verdict).toMatchObject({
      grounded: true,
      marks: [true, false, true],
    });
    expect(verdict.grounded && verdict.value).toBeCloseTo(2 / 3);
    expect(
      verdict.grounded && verdict.reasons.map((each) => each.claim),
    ).toEqual([0, 1, 2]);
  });

  it('is unreadable when a claim is missing, repeated, unnumbered, or given no reason or too many', () => {
    for (const claims of [
      [claim(0, true), claim(1, true)],
      [claim(0, true), claim(0, true), claim(1, true)],
      [claim(0, true), claim(1, true), claim(3, true)],
      [claim(0, true), claim(1, true), claim(2, true, [])],
      [
        claim(0, true),
        claim(1, true),
        claim(2, true, [grounded, grounded, grounded, grounded]),
      ],
    ]) {
      expect(groundedVerdict(claimsCriteria(), { claims }, EVIDENCE)).toEqual({
        grounded: false,
        failure: 'unreadable',
      });
    }
  });

  it('is ungrounded when any one claim rests mostly on what the run does not show', () => {
    expect(
      allThree(
        claim(0, true),
        claim(1, true, [grounded, ungrounded, ungrounded]),
        claim(2, true),
      ),
    ).toEqual({ grounded: false, failure: 'ungrounded' });
  });

  it('is unreadable when the judge answers a rubric’s verdict for claims, or claims for a rubric', () => {
    expect(
      groundedVerdict(
        claimsCriteria(),
        { value: true, reasons: [grounded] },
        EVIDENCE,
      ),
    ).toEqual({ grounded: false, failure: 'unreadable' });
    expect(
      groundedVerdict(
        JudgeCriteria.of({ rubric: 'Did it retry?' }),
        { claims: [claim(0, true)] },
        EVIDENCE,
      ),
    ).toEqual({ grounded: false, failure: 'unreadable' });
  });

  it('scores a rubric as before, with no marks', () => {
    expect(
      groundedVerdict(
        JudgeCriteria.of({ rubric: 'Did it retry?' }),
        { value: true, reasons: [grounded] },
        EVIDENCE,
      ),
    ).toMatchObject({ grounded: true, value: 1, marks: null });
  });
});
