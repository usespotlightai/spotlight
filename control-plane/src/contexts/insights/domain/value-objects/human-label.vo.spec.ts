import type { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import { HumanLabel } from '@insights/domain/value-objects/human-label.vo';
import {
  PersonAction,
  type ActionKind,
} from '@insights/domain/value-objects/person-action.vo';
import { PersonVerdict } from '@insights/domain/value-objects/person-verdict.vo';
import { ownedRecordOf } from '@insights/insights.fake-spec';
import { endedRecord, factOf, factsWith } from '@insights/runs.fake-spec';
import { firstOf } from '@shared-kernel/domain/item-at';
import { present } from '@shared-kernel/domain/present.fake-spec';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-09-30T11:00:00.000Z');

const NEXT_RUN_ENDED = new Date('2026-09-30T10:30:00.000Z');

const ACTOR = UserId.of('user_lin');

const actedOn = (action: ActionKind) =>
  endedRecord('run_1').recordAction(PersonAction.of(action, AT, ACTOR));

const pullRequestOf = (merged: boolean) =>
  ownedRecordOf('task_1', { openedAt: AT, closedAt: AT, merged });

const MERGED_LAST_RUN = {
  decidingAction: null,
  taskMerged: true,
  ending: 'completed',
  followed: false,
  personVerdict: null,
} as const;

const labelled = (change: {
  record?: RunRecord;
  laterRuns?: readonly RunRecord[];
  taskPullRequest?: PullRequestRecord | null;
}) => {
  const { record, laterRuns = [], taskPullRequest } = change;
  const fact = firstOf(
    factsWith(
      [record ?? endedRecord('run_1'), ...laterRuns],
      taskPullRequest ? [taskPullRequest] : [],
    ),
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
  ] as const)('labels a merged run that people %s as %s', (action, from) => {
    expect(
      HumanLabel.of({
        ...MERGED_LAST_RUN,
        decidingAction: PersonAction.of(action, AT, ACTOR),
      })?.from,
    ).toBe(from);
  });

  it.each(['failed', 'exhausted', 'cancelled', 'superseded'] as const)(
    'passes nothing a person accepted after a run that %s, which left no work to judge',
    (ending) => {
      expect(
        HumanLabel.of({
          ...MERGED_LAST_RUN,
          ending,
          decidingAction: PersonAction.of('accepted', AT, ACTOR),
        }),
      ).toBeNull();
    },
  );

  it.each(['failed', 'exhausted', 'cancelled', 'superseded'] as const)(
    'fails a run that %s where a person sent it back or held it',
    (ending) => {
      for (const action of ['sent-back', 'held-as-wrong'] as const) {
        expect(
          HumanLabel.of({
            ...MERGED_LAST_RUN,
            ending,
            decidingAction: PersonAction.of(action, AT, ACTOR),
          }),
        ).toEqual({ from: action, by: ACTOR });
      }
    },
  );

  it('labels what a person did after a run that stopped', () => {
    expect(
      HumanLabel.of({
        ...MERGED_LAST_RUN,
        ending: 'stopped',
        decidingAction: PersonAction.of('accepted', AT, ACTOR),
      })?.from,
    ).toBe('accepted');
  });

  it('labels a merge only on a completed run no later run followed', () => {
    expect(HumanLabel.of(MERGED_LAST_RUN)).toEqual({
      from: 'merged',
      by: null,
    });
    expect(HumanLabel.of({ ...MERGED_LAST_RUN, ending: 'stopped' })).toBeNull();
    expect(HumanLabel.of({ ...MERGED_LAST_RUN, followed: true })).toBeNull();
    expect(HumanLabel.of({ ...MERGED_LAST_RUN, taskMerged: false })).toBeNull();
  });
});

describe('a run fact’s human label', () => {
  it.each(['accepted', 'sent-back', 'held-as-wrong'] as const)(
    'labels a run people %s by that action, and by the person who did it',
    (action) => {
      expect(labelled({ record: actedOn(action) })).toEqual({
        from: action,
        by: ACTOR,
      });
    },
  );

  it.each(['approved', 'dismissed'] as const)(
    'knows nothing of a run people only %s a tool for',
    (action) => {
      expect(labelled({ record: actedOn(action) })).toBeNull();
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

  it('knows nothing of a run people only answered', () => {
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

describe('a run fact’s human label, where a person recorded a verdict', () => {
  const MARKED_AT = new Date('2026-09-30T12:00:00.000Z');
  const MARKER = UserId.of('user_ada');
  const verdictOf = (right: boolean) =>
    PersonVerdict.of({ right, reason: null, by: MARKER, at: MARKED_AT });

  it('labels a run that moved on, and whose pull request merged, by the verdict', () => {
    const record = actedOn('started').recordVerdict(verdictOf(false));
    const fact = present(firstOf(factsWith([record], [pullRequestOf(true)])));

    expect(fact.humanLabel).toEqual({ from: 'marked-wrong', by: MARKER });
    expect(fact.humanLabel?.passes).toBe(false);
    expect(fact.implicitLabel).toMatchObject({ from: 'merged' });
    expect(fact.resolution).toBe('sent-back');
    expect(fact.disposition).toBe('sent-back');
  });

  it('puts the verdict before what people did on the run', () => {
    const fact = factOf(actedOn('sent-back').recordVerdict(verdictOf(true)));

    expect(fact.humanLabel).toEqual({ from: 'marked-right', by: MARKER });
    expect(fact.implicitLabel).toMatchObject({ from: 'sent-back' });
    expect(fact.resolution).toBe('accepted');
  });

  it('labels a run by what people did once the verdict is cleared', () => {
    const fact = factOf(
      actedOn('sent-back').recordVerdict(verdictOf(true)).clearVerdict(),
    );

    expect(fact.humanLabel).toMatchObject({ from: 'sent-back' });
  });

  it('knows nothing of the verdict before it was given', () => {
    const fact = factOf(endedRecord('run_1').recordVerdict(verdictOf(false)));

    expect(fact.asOf(AT)?.humanLabel).toBeNull();
    expect(fact.asOf(MARKED_AT)?.humanLabel).toMatchObject({
      from: 'marked-wrong',
    });
  });
});
