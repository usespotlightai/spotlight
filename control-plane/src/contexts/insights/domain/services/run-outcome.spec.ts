import {
  judgeAgreesOf,
  outcomeRubricVersionOf,
  runOutcomeOf,
} from '@insights/domain/services/run-outcome';
import { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import {
  NEXT_RUBRIC_VERSION,
  personGrade,
  RUBRIC_VERSION,
} from '@insights/judging.fake-spec';
import { endedRecord, factsWith } from '@insights/runs.fake-spec';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-09-30T11:00:00.000Z');

const sentBack = () => {
  const [fact] = factsWith([
    endedRecord('run_1').recordAction(HumanAction.of('sent-back', AT)),
  ]);

  return fact ?? null;
};

describe('runOutcomeOf', () => {
  it('reads what people did with the run where nobody graded it', () => {
    expect(
      runOutcomeOf({
        rubricVersion: RUBRIC_VERSION,
        fact: sentBack(),
        grades: [],
      }),
    ).toEqual({ source: 'sent-back', passes: false });
  });

  it('takes a grade of the same rubric version over what people did', () => {
    expect(
      runOutcomeOf({
        rubricVersion: RUBRIC_VERSION,
        fact: sentBack(),
        grades: [personGrade('run_1', [true])],
      }),
    ).toEqual({ source: 'grade', passes: true });
  });

  it('reads only what people did where the run has no rubric version', () => {
    expect(
      runOutcomeOf({
        rubricVersion: null,
        fact: sentBack(),
        grades: [personGrade('run_1', [true])],
      }),
    ).toEqual({ source: 'sent-back', passes: false });
  });

  it('ignores a grade of another rubric version', () => {
    expect(
      runOutcomeOf({
        rubricVersion: NEXT_RUBRIC_VERSION,
        fact: null,
        grades: [personGrade('run_1', [true])],
      }),
    ).toBeNull();
  });
});

describe('judgeAgreesOf', () => {
  it('says whether the judge gave the verdict people gave', () => {
    const outcome = { source: 'accepted', passes: true } as const;

    expect(judgeAgreesOf({ passes: true }, outcome)).toBe(true);
    expect(judgeAgreesOf({ passes: false }, outcome)).toBe(false);
  });

  it('says nothing without a judge verdict or a human outcome', () => {
    expect(
      judgeAgreesOf(null, { source: 'sent-back', passes: false }),
    ).toBeNull();
    expect(judgeAgreesOf({ passes: true }, null)).toBeNull();
  });
});

describe('outcomeRubricVersionOf', () => {
  it('reads the claims of the judge shown on the run first', () => {
    expect(
      outcomeRubricVersionOf({
        visibleJudge: { rubricVersion: NEXT_RUBRIC_VERSION },
        currentRubricVersion: RUBRIC_VERSION,
        latestJudge: { rubricVersion: RUBRIC_VERSION },
      }),
    ).toBe(NEXT_RUBRIC_VERSION);
  });

  it('then the live claims of the station, then the claims of the latest judge', () => {
    expect(
      outcomeRubricVersionOf({
        visibleJudge: null,
        currentRubricVersion: RUBRIC_VERSION,
        latestJudge: { rubricVersion: NEXT_RUBRIC_VERSION },
      }),
    ).toBe(RUBRIC_VERSION);
    expect(
      outcomeRubricVersionOf({
        visibleJudge: null,
        currentRubricVersion: null,
        latestJudge: { rubricVersion: NEXT_RUBRIC_VERSION },
      }),
    ).toBe(NEXT_RUBRIC_VERSION);
    expect(
      outcomeRubricVersionOf({
        visibleJudge: null,
        currentRubricVersion: null,
        latestJudge: null,
      }),
    ).toBeNull();
  });
});
