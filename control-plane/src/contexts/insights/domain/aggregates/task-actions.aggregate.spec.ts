import { TaskActions } from '@insights/domain/aggregates/task-actions.aggregate';
import { InboxAsk } from '@insights/domain/value-objects/inbox-ask.vo';
import { TaskAction } from '@insights/domain/value-objects/task-action.vo';
import { day, taskActionsOf } from '@insights/insights.fake-spec';
import { WORKSPACE } from '@insights/runs.fake-spec';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

describe('TaskActions', () => {
  it('keeps asks and actions in time order, however they are received', () => {
    const answer = TaskAction.of({
      kind: 'answered',
      by: UserId.of('user_bob'),
      stationId: StationId.of('station_1'),
      at: day('2026-09-29', 10),
    });
    const taskActions = TaskActions.empty(TaskId.of('task_1'), WORKSPACE)
      .recordAction(answer)
      .asked(InboxAsk.of(StationId.of('station_1'), day('2026-09-29', 9)));

    const later = taskActions.asked(
      InboxAsk.of(StationId.of('station_1'), day('2026-09-29', 8)),
    );

    expect(later.asks.map((each) => each.at)).toEqual([
      day('2026-09-29', 8),
      day('2026-09-29', 9),
    ]);
    expect(later.actions).toEqual([answer]);
  });

  it('keeps each ask and action once, however often it is received', () => {
    const ask = InboxAsk.of(StationId.of('station_1'), day('2026-09-29', 9));
    const asked = TaskActions.empty(TaskId.of('task_1'), WORKSPACE).asked(ask);

    expect(
      asked.asked(InboxAsk.of(StationId.of('station_1'), day('2026-09-29', 9))),
    ).toBe(asked);
  });

  it('keeps its first opening', () => {
    const opened = taskActionsOf('task_1', { openedBy: 'user_ada' });
    const again = taskActionsOf('task_1', { openedBy: 'user_bob' }).opening;

    expect(again && opened.recordOpen(again)).toBe(opened);
  });

  it('takes its last action time from its latest opening, ask or action', () => {
    expect(
      taskActionsOf('task_1', {
        openedAt: day('2026-09-20'),
        asks: [['station_1', day('2026-09-29')]],
        actions: [['accepted', 'user_ada', 'station_1', day('2026-09-25')]],
      }).lastActionAt,
    ).toEqual(day('2026-09-29'));
  });
});
