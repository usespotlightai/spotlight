import type { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import { humanLabelOf } from '@insights/domain/services/human-label';
import {
  HumanAction,
  type HumanActionKind,
} from '@insights/domain/value-objects/human-action.vo';
import { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import { taskPullRequestOf } from '@insights/insights.fake-spec';
import {
  NEXT_RUBRIC_VERSION,
  personGrade,
  RUBRIC_VERSION,
} from '@insights/judging.fake-spec';
import { endedRecord, factsWith } from '@insights/runs.fake-spec';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-09-30T11:00:00.000Z');

const actedOn = (act: HumanActionKind) =>
  endedRecord('run_1').recordAction(HumanAction.of(act, AT));

const pullRequestOf = (merged: boolean) =>
  taskPullRequestOf('task_1', { openedAt: AT, closedAt: AT, merged });

const labelled = (
  change: Partial<Omit<Parameters<typeof humanLabelOf>[0], 'fact'>> & {
    record?: RunRecord;
    taskPullRequest?: PullRequestRecord | null;
  },
) => {
  const { record, taskPullRequest, ...rest } = change;
  const [fact] = factsWith(
    [record ?? endedRecord('run_1')],
    taskPullRequest ? [taskPullRequest] : [],
  );

  return humanLabelOf({
    scale: ScoreScale.yesNo(),
    rubricVersion: RUBRIC_VERSION,
    fact: fact ?? null,
    grades: [],
    ...rest,
  });
};

describe('humanLabelOf', () => {
  it.each([
    ['accepted', 1, 'accepted'],
    ['sent-back', 0, 'sent-back'],
  ] as const)('reads a run people %s as %s', (act, value, from) => {
    expect(labelled({ record: actedOn(act) })).toMatchObject({ value, from });
  });

  it.each(['approved', 'dismissed'] as const)(
    'knows nothing of a run people only %s a tool for',
    (act) => {
      expect(labelled({ record: actedOn(act) })).toBeNull();
    },
  );

  it('reads the task’s pull request where people did nothing that says', () => {
    expect(labelled({ taskPullRequest: pullRequestOf(true) })).toMatchObject({
      value: 1,
      from: 'merged',
    });
    expect(labelled({ taskPullRequest: pullRequestOf(false) })).toMatchObject({
      value: 0,
      from: 'closed',
    });
  });

  it('knows nothing of a run people have not yet acted on', () => {
    expect(labelled({ record: actedOn('answered') })).toBeNull();
  });

  it('lets a person’s latest grade win over what they did', () => {
    expect(
      labelled({
        record: actedOn('accepted'),
        grades: [
          personGrade('run_1', ScoreScale.yesNo(), 1, {
            by: 'user_ada',
            at: new Date('2026-09-30T12:00:00.000Z'),
          }),
          personGrade('run_1', ScoreScale.yesNo(), 0, {
            by: 'user_grace',
            at: new Date('2026-09-30T13:00:00.000Z'),
          }),
        ],
      }),
    ).toEqual({ value: 0, claimResults: null, from: 'grade' });
  });

  it('labels a number rubric only by people’s grades', () => {
    const scale = ScoreScale.oneToFive();

    expect(labelled({ scale, record: actedOn('accepted') })).toBeNull();
    expect(
      labelled({ scale, grades: [personGrade('run_1', scale, 4)] }),
    ).toEqual({ value: 4, claimResults: null, from: 'grade' });
  });

  it('reads a grade only by the rubric it was given under, where it names one', () => {
    const scale = ScoreScale.oneToFive();
    const earlier = personGrade('run_1', scale, 4);
    const unnamed = personGrade('run_1', scale, 2, { rubricVersion: null });

    expect(
      labelled({
        scale,
        rubricVersion: NEXT_RUBRIC_VERSION,
        grades: [earlier],
      }),
    ).toBeNull();
    expect(
      labelled({
        scale,
        rubricVersion: NEXT_RUBRIC_VERSION,
        grades: [earlier, unnamed],
      }),
    ).toEqual({ value: 2, claimResults: null, from: 'grade' });
  });
});
