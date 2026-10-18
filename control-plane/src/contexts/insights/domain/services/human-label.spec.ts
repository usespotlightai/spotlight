import { TaskPullRequest } from '@insights/domain/aggregates/task-pull-request.aggregate';
import {
  NEXT_RUBRIC_VERSION,
  personGrade,
  RUBRIC_VERSION,
} from '@insights/domain/judging.fake-spec';
import { endedRecord, TEAM, WORKSPACE } from '@insights/domain/runs.fake-spec';
import { humanLabelOf } from '@insights/domain/services/human-label';
import {
  HumanAction,
  type HumanActionKind,
} from '@insights/domain/value-objects/human-action.vo';
import { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const PULL = PullRequestUrl.of('https://github.com/acme/api/pull/3');
const AT = new Date('2026-09-30T11:00:00.000Z');

const actedOn = (act: HumanActionKind) =>
  endedRecord('run_1').recordAction(HumanAction.of(act, AT));

const pullRequestOf = (merged: boolean) =>
  TaskPullRequest.open({
    taskId: TaskId.of('task_1'),
    workspaceId: WORKSPACE,
    teamId: TEAM,
    pullRequest: PULL,
    at: AT,
  }).close({ pullRequest: PULL, merged, at: AT });

const labelled = (change: Partial<Parameters<typeof humanLabelOf>[0]>) =>
  humanLabelOf({
    scale: ScoreScale.yesNo(),
    rubricVersion: RUBRIC_VERSION,
    record: endedRecord('run_1'),
    taskPullRequest: null,
    grades: [],
    ...change,
  });

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
