import type { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import {
  humanLabelOf,
  judgeAgreesOf,
  passesOn,
} from '@insights/domain/services/human-label';
import {
  HumanAction,
  type HumanActionKind,
} from '@insights/domain/value-objects/human-action.vo';
import { taskPullRequestOf } from '@insights/insights.fake-spec';
import { endedRecord, factsWith } from '@insights/runs.fake-spec';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-09-30T11:00:00.000Z');

const NEXT_VISIT_ENDED = new Date('2026-09-30T10:30:00.000Z');

const ACTOR = UserId.of('user_lin');

const actedOn = (act: HumanActionKind) =>
  endedRecord('run_1').recordAction(HumanAction.of(act, AT, ACTOR));

const pullRequestOf = (merged: boolean) =>
  taskPullRequestOf('task_1', { openedAt: AT, closedAt: AT, merged });

const labelled = (change: {
  record?: RunRecord;
  laterRuns?: readonly RunRecord[];
  taskPullRequest?: PullRequestRecord | null;
}) => {
  const { record, laterRuns = [], taskPullRequest } = change;
  const [fact] = factsWith(
    [record ?? endedRecord('run_1'), ...laterRuns],
    taskPullRequest ? [taskPullRequest] : [],
  );

  return humanLabelOf(fact ?? null);
};

describe('humanLabelOf', () => {
  it.each([
    ['accepted', true, 'accepted'],
    ['sent-back', false, 'sent-back'],
    ['held', false, 'held'],
  ] as const)(
    'reads a run people %s as passes %s, by the person who did it',
    (act, passes, from) => {
      expect(labelled({ record: actedOn(act) })).toEqual({
        passes,
        from,
        by: ACTOR,
      });
    },
  );

  it.each(['approved', 'dismissed'] as const)(
    'knows nothing of a run people only %s a tool for',
    (act) => {
      expect(labelled({ record: actedOn(act) })).toBeNull();
    },
  );

  it('passes a run whose task’s pull request merged, where people did nothing that says', () => {
    expect(labelled({ taskPullRequest: pullRequestOf(true) })).toEqual({
      passes: true,
      from: 'merged',
      by: null,
    });
  });

  it('knows nothing of a run whose task’s pull request closed without a merge', () => {
    expect(labelled({ taskPullRequest: pullRequestOf(false) })).toBeNull();
  });

  it.each(['failed', 'stopped', 'exhausted', 'cancelled'] as const)(
    'gives a merge nothing to say of a run that %s',
    (ending) => {
      expect(
        labelled({
          record: endedRecord('run_1', { ending }),
          taskPullRequest: pullRequestOf(true),
        }),
      ).toBeNull();
    },
  );

  it('gives a merge nothing to say of a run its task superseded', () => {
    expect(
      labelled({
        record: endedRecord('run_1').supersededByItsTask(AT),
        taskPullRequest: pullRequestOf(true),
      }),
    ).toBeNull();
  });

  it('gives the merge to the station’s last completed run on the task, not to the runs before it', () => {
    const later = endedRecord('run_2', { endedAt: NEXT_VISIT_ENDED, visit: 2 });

    expect(
      labelled({ laterRuns: [later], taskPullRequest: pullRequestOf(true) }),
    ).toBeNull();
    expect(
      humanLabelOf(
        factsWith([endedRecord('run_1'), later], [pullRequestOf(true)]).find(
          (each) => each.runId.value === 'run_2',
        ) ?? null,
      ),
    ).toMatchObject({ passes: true, from: 'merged' });
  });

  it('keeps the merge on a run whose later visit did not complete, or that a run at another station followed', () => {
    expect(
      labelled({
        laterRuns: [
          endedRecord('run_2', {
            endedAt: NEXT_VISIT_ENDED,
            visit: 2,
            ending: 'failed',
          }),
          endedRecord('run_3', {
            endedAt: NEXT_VISIT_ENDED,
            stationId: 'station_2',
          }),
        ],
        taskPullRequest: pullRequestOf(true),
      }),
    ).toMatchObject({ passes: true, from: 'merged' });
  });

  it('lets what a person did on a run still count after a later visit', () => {
    expect(
      labelled({
        record: actedOn('sent-back'),
        laterRuns: [
          endedRecord('run_2', { endedAt: NEXT_VISIT_ENDED, visit: 2 }),
        ],
        taskPullRequest: pullRequestOf(true),
      }),
    ).toMatchObject({ passes: false, from: 'sent-back' });
  });

  it('knows nothing of a run people have not yet acted on', () => {
    expect(labelled({ record: actedOn('answered') })).toBeNull();
  });
});

describe('passesOn', () => {
  it('passes the run where people accepted it or merged its pull request', () => {
    expect(passesOn('accepted')).toBe(true);
    expect(passesOn('merged')).toBe(true);
    expect(passesOn('sent-back')).toBe(false);
    expect(passesOn('held')).toBe(false);
  });
});

describe('judgeAgreesOf', () => {
  it('says whether the judge gave the verdict people gave', () => {
    expect(judgeAgreesOf({ passes: true }, { passes: true })).toBe(true);
    expect(judgeAgreesOf({ passes: false }, { passes: true })).toBe(false);
  });

  it('says nothing without a judge verdict or a human label', () => {
    expect(judgeAgreesOf(null, { passes: false })).toBeNull();
    expect(judgeAgreesOf({ passes: true }, null)).toBeNull();
  });
});
