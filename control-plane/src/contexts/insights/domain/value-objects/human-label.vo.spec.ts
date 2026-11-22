import type { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import {
  HumanAction,
  type HumanActionKind,
} from '@insights/domain/value-objects/human-action.vo';
import { HumanLabel } from '@insights/domain/value-objects/human-label.vo';
import { ownedRecordOf } from '@insights/insights.fake-spec';
import { endedRecord, factsWith } from '@insights/runs.fake-spec';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-09-30T11:00:00.000Z');

const NEXT_RUN_ENDED = new Date('2026-09-30T10:30:00.000Z');

const ACTOR = UserId.of('user_lin');

const actedOn = (act: HumanActionKind) =>
  endedRecord('run_1').recordAction(HumanAction.of(act, AT, ACTOR));

const pullRequestOf = (merged: boolean) =>
  ownedRecordOf('task_1', { openedAt: AT, closedAt: AT, merged });

const MERGED_LAST_RUN = {
  firstHumanAction: null,
  taskMerged: true,
  ending: 'completed',
  followedAt: null,
} as const;

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

  return fact?.humanLabel ?? null;
};

describe('HumanLabel.of', () => {
  it.each([
    ['accepted', 'accepted'],
    ['sent-back', 'sent-back'],
    ['held-as-wrong', 'held-as-wrong'],
    ['started', 'merged'],
    ['parked', 'merged'],
    ['answered', 'merged'],
  ] as const)(
    'labels a merged run whose first act is %s as %s',
    (act, from) => {
      expect(
        HumanLabel.of({
          ...MERGED_LAST_RUN,
          firstHumanAction: HumanAction.of(act, AT, ACTOR),
        })?.from,
      ).toBe(from);
    },
  );

  it('labels a merge only on a completed run no later run followed', () => {
    expect(HumanLabel.of(MERGED_LAST_RUN)).toEqual({
      from: 'merged',
      by: null,
    });
    expect(HumanLabel.of({ ...MERGED_LAST_RUN, ending: 'stopped' })).toBeNull();
    expect(
      HumanLabel.of({ ...MERGED_LAST_RUN, followedAt: NEXT_RUN_ENDED }),
    ).toBeNull();
    expect(HumanLabel.of({ ...MERGED_LAST_RUN, taskMerged: false })).toBeNull();
  });
});

describe('a run fact’s human label', () => {
  it.each(['accepted', 'sent-back', 'held-as-wrong'] as const)(
    'labels a run people %s by that act, and by the person who did it',
    (act) => {
      expect(labelled({ record: actedOn(act) })).toEqual({
        from: act,
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

  it('labels a run merged where its task’s pull request merged and people did nothing that says', () => {
    expect(labelled({ taskPullRequest: pullRequestOf(true) })).toEqual({
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
    const later = endedRecord('run_2', {
      endedAt: NEXT_RUN_ENDED,
      runNumber: 2,
    });

    expect(
      labelled({ laterRuns: [later], taskPullRequest: pullRequestOf(true) }),
    ).toBeNull();
    expect(
      factsWith([endedRecord('run_1'), later], [pullRequestOf(true)]).find(
        (each) => each.runId.value === 'run_2',
      )?.humanLabel,
    ).toMatchObject({ from: 'merged' });
  });

  it('keeps the merge on a run whose later run did not complete, or that a run at another station followed', () => {
    expect(
      labelled({
        laterRuns: [
          endedRecord('run_2', {
            endedAt: NEXT_RUN_ENDED,
            runNumber: 2,
            ending: 'failed',
          }),
          endedRecord('run_3', {
            endedAt: NEXT_RUN_ENDED,
            stationId: 'station_2',
          }),
        ],
        taskPullRequest: pullRequestOf(true),
      }),
    ).toMatchObject({ from: 'merged' });
  });

  it('lets what a person did on a run still count after a later run', () => {
    expect(
      labelled({
        record: actedOn('sent-back'),
        laterRuns: [
          endedRecord('run_2', { endedAt: NEXT_RUN_ENDED, runNumber: 2 }),
        ],
        taskPullRequest: pullRequestOf(true),
      }),
    ).toMatchObject({ from: 'sent-back' });
  });

  it('knows nothing of a run whose first act gives no label', () => {
    expect(labelled({ record: actedOn('answered') })).toBeNull();
  });
});

describe('HumanLabel.agreesWith', () => {
  it('says whether the judge gave the verdict people gave', () => {
    const accepted = labelled({ record: actedOn('accepted') });
    const sentBack = labelled({ record: actedOn('sent-back') });

    expect(accepted?.agreesWith({ passes: true })).toBe(true);
    expect(sentBack?.agreesWith({ passes: true })).toBe(false);
    expect(HumanLabel.of(MERGED_LAST_RUN)?.agreesWith({ passes: false })).toBe(
      false,
    );
  });
});
