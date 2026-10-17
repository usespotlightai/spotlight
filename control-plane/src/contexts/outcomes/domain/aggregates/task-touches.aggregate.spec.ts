import { TaskTouches } from '@outcomes/domain/aggregates/task-touches.aggregate';
import { day, touchesOf } from '@outcomes/domain/insights.fake-spec';
import { WORKSPACE } from '@outcomes/domain/outcomes.fake-spec';
import { InboxAsk } from '@outcomes/domain/value-objects/inbox-ask.vo';
import { PersonTouch } from '@outcomes/domain/value-objects/person-touch.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

describe('TaskTouches', () => {
  it('pairs each ask with the first thing a person did after it', () => {
    const touches = touchesOf('task_1', {
      asks: [
        ['station_1', day('2026-09-29', 9)],
        ['station_2', day('2026-09-29', 14)],
      ],
      acts: [
        ['answered', 'user_bob', 'station_1', day('2026-09-29', 10)],
        ['approved', 'user_ada', 'station_1', day('2026-09-29', 11)],
      ],
    });

    expect(touches.waits()).toEqual([
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
    const touches = touchesOf('task_1', {
      asks: [
        ['station_1', day('2026-09-29', 9)],
        ['station_1', day('2026-09-29', 10)],
      ],
      acts: [['answered', 'user_bob', 'station_1', day('2026-09-29', 11)]],
    });

    expect(touches.waits().map((each) => each.answeredAt)).toEqual([
      null,
      day('2026-09-29', 11),
    ]);
  });

  it('answers each ask with the first act from the moment it was asked until the next ask, wherever the act was done', () => {
    const touches = touchesOf('task_1', {
      asks: [
        ['station_1', day('2026-09-29', 9)],
        ['station_2', day('2026-09-29', 12)],
      ],
      acts: [
        ['answered', 'user_bob', 'station_9', day('2026-09-29', 9)],
        ['approved', 'user_ada', 'station_1', day('2026-09-29', 10)],
        ['closed', 'user_cy', 'station_2', day('2026-09-29', 12)],
      ],
    });

    expect(
      touches.waits().map((each) => [each.answeredAt, each.answeredBy]),
    ).toEqual([
      [day('2026-09-29', 9), 'user_bob'],
      [day('2026-09-29', 12), 'user_cy'],
    ]);
  });

  it('pairs asks and answers received in any order', () => {
    const answer = PersonTouch.of({
      act: 'answered',
      by: UserId.of('user_bob'),
      stationId: 'station_1',
      at: day('2026-09-29', 10),
    });
    const touches = TaskTouches.empty(TaskId.of('task_1'), WORKSPACE)
      .recordAction(answer)
      .asked(InboxAsk.of('station_1', day('2026-09-29', 9)));

    expect(touches.waits()[0]?.answeredBy).toBe('user_bob');
  });

  it('keeps each ask and act once, however often it is received', () => {
    const ask = InboxAsk.of('station_1', day('2026-09-29', 9));
    const asked = TaskTouches.empty(TaskId.of('task_1'), WORKSPACE).asked(ask);

    expect(asked.asked(InboxAsk.of('station_1', day('2026-09-29', 9)))).toBe(
      asked,
    );
  });

  it('keeps its first opening', () => {
    const opened = touchesOf('task_1', { openedBy: 'user_ada' });
    const again = touchesOf('task_1', { openedBy: 'user_bob' }).opening;

    expect(again && opened.recordOpen(again)).toBe(opened);
  });

  it('was last touched by its latest opening, ask or act', () => {
    expect(
      touchesOf('task_1', {
        openedAt: day('2026-09-20'),
        asks: [['station_1', day('2026-09-29')]],
        acts: [['closed', 'user_ada', 'station_1', day('2026-09-25')]],
      }).touchedAt,
    ).toEqual(day('2026-09-29'));
  });
});
