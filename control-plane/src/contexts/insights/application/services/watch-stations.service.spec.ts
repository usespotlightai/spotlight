import { deletionsInMemory } from '@insights/application/ports/deletions.fake-spec';
import type { WorkPort } from '@insights/application/ports/work.port';
import { WatchStations } from '@insights/application/services/watch-stations.service';
import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { StationAlertState } from '@insights/domain/aggregates/station-alert-state.aggregate';
import { StationAlertStatesInMemory } from '@insights/domain/alerts.fake-spec';
import { RunRecordEnded } from '@insights/domain/events/run-record-ended.event';
import { RunRecordEnriched } from '@insights/domain/events/run-record-enriched.event';
import { TaskPullRequestClosed } from '@insights/domain/events/task-pull-request-closed.event';
import { StationAlertStateVersionConflictError } from '@insights/domain/exceptions/station-alert-state-version-conflict.error';
import { day, taskPullRequestOf } from '@insights/domain/insights.fake-spec';
import {
  endedRecord,
  inTransaction,
  RunRecordsInMemory,
  TaskPullRequestsInMemory,
  WORKSPACE,
} from '@insights/domain/runs.fake-spec';
import { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import { AlertRule } from '@insights/domain/value-objects/alert-rule.vo';
import { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const SENT_BACK_RISES = AlertRule.of({
  measure: 'sent_back_rate',
  risesBy: 0.5,
  over: 2,
});

const watching = (initially: readonly AlertRule[] | null) => {
  let alerts = initially;
  const records = new RunRecordsInMemory();
  const taskPullRequests = new TaskPullRequestsInMemory();
  const alertStates = new StationAlertStatesInMemory();
  const deletions = deletionsInMemory();
  let next = 0;
  const work: WorkPort = {
    endedRun: async () => null,
    configsInOrder: async () => [],
    teamRepositories: async () => [],
    teamSkillKeys: async () => [],
    alertsAt: async () => alerts,
  };
  const service = new WatchStations(
    work,
    {
      records,
      taskPullRequests,
      alertStates,
      deletions,
    },
    inTransaction,
    {
      generate: () => {
        next += 1;
        return `alert_${next}`;
      },
    },
    { now: () => day('2026-09-30', 23), sleep: async () => {} },
  );

  const ran = async (hour: number, act: 'accepted' | 'sent-back') => {
    const record = endedRecord(`run_${hour}`, {
      taskId: `task_${hour}`,
      endedAt: day('2026-09-30', hour),
    }).recordAction(HumanAction.of(act, day('2026-09-30', hour)));
    const [ended] = record.pullEvents();
    await records.add(record);
    await service.runEnded(ended as RunRecordEnded);
  };

  const ended = async (hour: number) => {
    const record = endedRecord(`run_${hour}`, {
      taskId: `task_${hour}`,
      endedAt: day('2026-09-30', hour),
    });
    const [event] = record.pullEvents();
    await records.add(record);
    await service.runEnded(event as RunRecordEnded);
  };

  const actedOn = async (hour: number, act: 'accepted' | 'sent-back') => {
    const record = await records.of(RunId.of(`run_${hour}`));
    const acted = record?.recordAction(
      HumanAction.of(act, day('2026-09-30', hour + 1)),
    );
    const [event] = acted?.pullEvents() ?? [];
    expect(event).toBeInstanceOf(RunRecordEnriched);
    await records.save(acted as RunRecord);
    await service.runEnriched(event as RunRecordEnriched);
  };

  const closedPullRequest = async (hour: number, merged: boolean) => {
    const closed = taskPullRequestOf(`task_${hour}`, {
      openedAt: day('2026-09-30', hour),
      closedAt: day('2026-09-30', hour + 1),
      merged,
    });
    const [event] = closed.pullEvents();
    expect(event).toBeInstanceOf(TaskPullRequestClosed);
    await taskPullRequests.add(closed);
    await service.pullRequestClosed(event as TaskPullRequestClosed);
  };

  const kinds = () => alertStates.raised.map((each) => each.kind);

  const updated = async (next: readonly AlertRule[] | null) => {
    alerts = next;
    await service.lineChanged({
      lineId: 'line_1',
      workspaceId: WORKSPACE.value,
      teamId: 'team_1',
      stationIds: ['station_1'],
    });
  };

  return {
    updated,
    ran,
    ended,
    actedOn,
    closedPullRequest,
    kinds,
    alertStates,
    deletions,
    service,
  };
};

describe('WatchStations', () => {
  it('fires an alert once the last runs are sent back more than the runs before them', async () => {
    const station = watching([SENT_BACK_RISES]);

    await station.ran(1, 'accepted');
    await station.ran(2, 'accepted');
    await station.ran(3, 'sent-back');
    expect(station.kinds()).toEqual([]);

    await station.ran(4, 'sent-back');
    await station.ran(5, 'sent-back');

    expect(station.kinds()).toEqual(['station-alert.fired']);
    expect(
      (await station.alertStates.of('station_1'))?.open[0]?.taskId.value,
    ).toBe('task_4');
  });

  it('reopens the alert it resolved when the station rises again within its cooldown runs', async () => {
    const station = watching([SENT_BACK_RISES]);

    for (const [hour, act] of [
      [1, 'accepted'],
      [2, 'accepted'],
      [3, 'sent-back'],
      [4, 'sent-back'],
      [5, 'accepted'],
      [6, 'accepted'],
      [7, 'sent-back'],
      [8, 'sent-back'],
    ] as const) {
      await station.ran(hour, act);
    }

    expect(station.kinds()).toEqual([
      'station-alert.fired',
      'station-alert.resolved',
      'station-alert.reopened',
    ]);
    expect(station.alertStates.stored.get('station_1')?.firings).toHaveLength(
      1,
    );
  });

  it('fires a new alert once the station has stayed clear past its cooldown runs', async () => {
    const station = watching([SENT_BACK_RISES]);

    for (const [hour, act] of [
      [1, 'accepted'],
      [2, 'accepted'],
      [3, 'sent-back'],
      [4, 'sent-back'],
      [5, 'accepted'],
      [6, 'accepted'],
      [7, 'accepted'],
      [8, 'accepted'],
      [9, 'sent-back'],
      [10, 'sent-back'],
    ] as const) {
      await station.ran(hour, act);
    }

    expect(station.kinds()).toEqual([
      'station-alert.fired',
      'station-alert.resolved',
      'station-alert.fired',
    ]);
  });

  it('resolves an alert at once when the line no longer sets its rule', async () => {
    const station = watching([
      AlertRule.of({ measure: 'sent_back_rate', above: 0.4, over: 1 }),
    ]);
    await station.ran(1, 'sent-back');

    await station.updated([]);

    expect(station.kinds()).toEqual([
      'station-alert.fired',
      'station-alert.resolved',
    ]);
  });

  it('resolves an alert when its station leaves the line', async () => {
    const station = watching([
      AlertRule.of({ measure: 'sent_back_rate', above: 0.4, over: 1 }),
    ]);
    await station.ran(1, 'sent-back');

    await station.updated(null);

    expect(station.kinds()).toEqual([
      'station-alert.fired',
      'station-alert.resolved',
    ]);
  });

  it('takes the team and the alert’s task in hand before it reads whether they were deleted', async () => {
    const station = watching([
      AlertRule.of({ measure: 'sent_back_rate', above: 0.4, over: 1 }),
    ]);

    await station.ran(1, 'sent-back');

    expect(station.deletions.locks).toEqual([
      `${WORKSPACE.value} team_1`,
      `${WORKSPACE.value} team_1 task_1`,
    ]);
  });

  it('fires nothing on a run whose task was deleted while it was read', async () => {
    const station = watching([
      AlertRule.of({ measure: 'sent_back_rate', above: 0.4, over: 1 }),
    ]);
    await station.deletions.deleteTask(WORKSPACE, TaskId.of('task_1'));

    await station.ran(1, 'sent-back');

    expect(station.kinds()).toEqual([]);
  });

  it('keeps no alert state for a station that sets no alerts', async () => {
    const station = watching(null);

    await station.ran(1, 'sent-back');

    expect(station.alertStates.stored.size).toBe(0);
  });

  it('watches nothing for a run whose task was deleted', async () => {
    const station = watching([
      AlertRule.of({ measure: 'sent_back_rate', above: 0.4, over: 1 }),
    ]);
    await station.deletions.deleteWorkspace(WORKSPACE);

    await station.ran(1, 'sent-back');

    expect(station.alertStates.stored.size).toBe(0);
  });

  it('reads an accepted rate only from runs a person acted on, so a newest run nobody answered yet trips nothing', async () => {
    const station = watching([
      AlertRule.of({ measure: 'accepted_rate', fallsBy: 0.5, over: 2 }),
    ]);

    for (const hour of [1, 2, 3, 4]) {
      await station.ran(hour, 'accepted');
    }
    await station.ended(5);

    expect(station.kinds()).toEqual([]);
  });

  it('resolves once a person accepts a run that ended unanswered', async () => {
    const station = watching([
      AlertRule.of({ measure: 'accepted_rate', below: 0.5, over: 1 }),
    ]);

    await station.ran(1, 'sent-back');
    await station.ended(2);
    expect(station.kinds()).toEqual(['station-alert.fired']);

    await station.actedOn(2, 'accepted');

    expect(station.kinds()).toEqual([
      'station-alert.fired',
      'station-alert.resolved',
    ]);
  });

  it('reads the merged rate once pull requests close, firing on one closed unmerged and resolving on one merged', async () => {
    const station = watching([
      AlertRule.of({ measure: 'merged_rate', below: 0.5, over: 1 }),
    ]);

    await station.ended(1);
    expect(station.kinds()).toEqual([]);

    await station.closedPullRequest(1, false);
    expect(station.kinds()).toEqual(['station-alert.fired']);

    await station.ended(3);
    await station.closedPullRequest(3, true);

    expect(station.kinds()).toEqual([
      'station-alert.fired',
      'station-alert.resolved',
    ]);
  });

  it('keeps an alert deleted once its task is, even when a check read before the deletion saves after it', async () => {
    const station = watching([
      AlertRule.of({ measure: 'accepted_rate', below: 0.5, over: 1 }),
    ]);
    await station.ran(1, 'sent-back');
    const stale = await station.alertStates.of('station_1');

    for (const stationId of await station.alertStates.stationsWithTask(
      TaskId.of('task_1'),
    )) {
      const alertState = await station.alertStates.of(
        stationId,
        TaskId.of('task_1'),
      );
      await station.alertStates.save(
        (alertState as StationAlertState).withoutTask(TaskId.of('task_1')),
      );
    }

    await expect(
      station.alertStates.save(
        (stale as StationAlertState).check([], day('2026-09-30', 23), () =>
          AlertId.of('alert_9'),
        ),
      ),
    ).rejects.toBeInstanceOf(StationAlertStateVersionConflictError);
    expect((await station.alertStates.of('station_1'))?.firings).toEqual([]);
  });
});
