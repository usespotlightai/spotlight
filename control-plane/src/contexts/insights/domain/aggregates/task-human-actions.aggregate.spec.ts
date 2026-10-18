import { TaskHumanActions } from '@insights/domain/aggregates/task-human-actions.aggregate';
import { day, humanActionsOf } from '@insights/domain/insights.fake-spec';
import { WORKSPACE } from '@insights/domain/runs.fake-spec';
import { InboxAsk } from '@insights/domain/value-objects/inbox-ask.vo';
import { TaskHumanAction } from '@insights/domain/value-objects/task-human-action.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

describe('TaskHumanActions', () => {
  it('pairs each ask with the first thing a person did after it', () => {
    const humanActions = humanActionsOf('task_1', {
      asks: [
        ['station_1', day('2026-09-29', 9)],
        ['station_2', day('2026-09-29', 14)],
      ],
      actions: [
        ['answered', 'user_bob', 'station_1', day('2026-09-29', 10)],
        ['approved', 'user_ada', 'station_1', day('2026-09-29', 11)],
      ],
    });

    expect(humanActions.waits()).toEqual([
      {
        stationId: 'station_1',
        askedAt: day('2026-09-29', 9),
        answeredAt: day('2026-09-29', 10),
        answeredBy: 'user_bob',
      },
      {
        stationId: 'station_2',
        askedAt: day('2026-09-29', 14),
        answeredAt: null,
        answeredBy: null,
      },
    ]);
  });

  it('answers no ask with an act from before the next one was asked', () => {
    const humanActions = humanActionsOf('task_1', {
      asks: [
        ['station_1', day('2026-09-29', 9)],
        ['station_1', day('2026-09-29', 10)],
      ],
      actions: [['answered', 'user_bob', 'station_1', day('2026-09-29', 11)]],
    });

    expect(humanActions.waits().map((each) => each.answeredAt)).toEqual([
      null,
      day('2026-09-29', 11),
    ]);
  });

  it('answers each ask with the first act from the moment it was asked until the next ask, wherever the act was done', () => {
    const humanActions = humanActionsOf('task_1', {
      asks: [
        ['station_1', day('2026-09-29', 9)],
        ['station_2', day('2026-09-29', 12)],
      ],
      actions: [
        ['answered', 'user_bob', 'station_9', day('2026-09-29', 9)],
        ['approved', 'user_ada', 'station_1', day('2026-09-29', 10)],
        ['accepted', 'user_cy', 'station_2', day('2026-09-29', 12)],
      ],
    });

    expect(
      humanActions.waits().map((each) => [each.answeredAt, each.answeredBy]),
    ).toEqual([
      [day('2026-09-29', 9), 'user_bob'],
      [day('2026-09-29', 12), 'user_cy'],
    ]);
  });

  it('pairs asks and answers received in any order', () => {
    const answer = TaskHumanAction.of({
      kind: 'answered',
      by: UserId.of('user_bob'),
      stationId: 'station_1',
      at: day('2026-09-29', 10),
    });
    const humanActions = TaskHumanActions.empty(TaskId.of('task_1'), WORKSPACE)
      .recordAction(answer)
      .asked(InboxAsk.of('station_1', day('2026-09-29', 9)));

    expect(humanActions.waits()[0]?.answeredBy).toBe('user_bob');
  });

  it('keeps each ask and act once, however often it is received', () => {
    const ask = InboxAsk.of('station_1', day('2026-09-29', 9));
    const asked = TaskHumanActions.empty(TaskId.of('task_1'), WORKSPACE).asked(
      ask,
    );

    expect(asked.asked(InboxAsk.of('station_1', day('2026-09-29', 9)))).toBe(
      asked,
    );
  });

  it('keeps its first opening', () => {
    const opened = humanActionsOf('task_1', { openedBy: 'user_ada' });
    const again = humanActionsOf('task_1', { openedBy: 'user_bob' }).opening;

    expect(again && opened.recordOpen(again)).toBe(opened);
  });

  it('takes its last action time from its latest opening, ask or action', () => {
    expect(
      humanActionsOf('task_1', {
        openedAt: day('2026-09-20'),
        asks: [['station_1', day('2026-09-29')]],
        actions: [['accepted', 'user_ada', 'station_1', day('2026-09-25')]],
      }).lastActionAt,
    ).toEqual(day('2026-09-29'));
  });
});
