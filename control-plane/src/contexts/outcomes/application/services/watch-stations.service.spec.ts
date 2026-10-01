import { forgottenInMemory } from '@outcomes/application/ports/forgotten.fake-spec';
import type { WorkPort } from '@outcomes/application/ports/work.port';
import { WatchStations } from '@outcomes/application/services/watch-stations.service';
import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { StationWatch } from '@outcomes/domain/aggregates/station-watch.aggregate';
import { StationWatchesInMemory } from '@outcomes/domain/alerts.fake-spec';
import { RunRecordEnded } from '@outcomes/domain/events/run-record-ended.event';
import { RunRecordSettled } from '@outcomes/domain/events/run-record-settled.event';
import { TaskDeliveryClosed } from '@outcomes/domain/events/task-delivery-closed.event';
import { StationWatchMovedOnError } from '@outcomes/domain/exceptions/station-watch-moved-on.error';
import { day, deliveredOf } from '@outcomes/domain/insights.fake-spec';
import {
  endedRecord,
  inTransaction,
  RunRecordsInMemory,
  TaskDeliveriesInMemory,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import { AlertId } from '@outcomes/domain/value-objects/alert-id.vo';
import { AlertRule } from '@outcomes/domain/value-objects/alert-rule.vo';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
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
  const deliveries = new TaskDeliveriesInMemory();
  const watches = new StationWatchesInMemory();
  const forgotten = forgottenInMemory();
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
      deliveries,
      watches,
      forgotten,
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

  const ran = async (hour: number, act: 'approved' | 'sent-back') => {
    const record = endedRecord(`run_${hour}`, {
      taskId: `task_${hour}`,
      endedAt: day('2026-09-30', hour),
    }).actedOn(NextAct.of(act, day('2026-09-30', hour)));
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

  const actedOn = async (hour: number, act: 'approved' | 'sent-back') => {
    const held = await records.of(RunId.of(`run_${hour}`));
    const acted = held?.actedOn(NextAct.of(act, day('2026-09-30', hour + 1)));
    const [event] = acted?.pullEvents() ?? [];
    expect(event).toBeInstanceOf(RunRecordSettled);
    await records.save(acted as RunRecord);
    await service.runSettled(event as RunRecordSettled);
  };

  const delivered = async (hour: number, merged: boolean) => {
    const closed = deliveredOf(`task_${hour}`, {
      openedAt: day('2026-09-30', hour),
      closedAt: day('2026-09-30', hour + 1),
      merged,
    });
    const [event] = closed.pullEvents();
    expect(event).toBeInstanceOf(TaskDeliveryClosed);
    await deliveries.add(closed);
    await service.deliveryClosed(event as TaskDeliveryClosed);
  };

  const kinds = () => watches.raised.map((each) => each.kind);

  const redefined = async (next: readonly AlertRule[] | null) => {
    alerts = next;
    await service.lineRedefined({
      lineId: 'line_1',
      workspaceId: WORKSPACE.value,
      teamId: 'team_1',
      stationIds: ['station_1'],
    });
  };

  return {
    redefined,
    ran,
    ended,
    actedOn,
    delivered,
    kinds,
    watches,
    forgotten,
    service,
  };
};

describe('WatchStations', () => {
  it('raises an alert once the last runs are sent back more than the runs before them', async () => {
    const station = watching([SENT_BACK_RISES]);

    await station.ran(1, 'approved');
    await station.ran(2, 'approved');
    await station.ran(3, 'sent-back');
    expect(station.kinds()).toEqual([]);

    await station.ran(4, 'sent-back');
    await station.ran(5, 'sent-back');

    expect(station.kinds()).toEqual(['station-alert.raised']);
    expect((await station.watches.of('station_1'))?.open[0]?.taskId.value).toBe(
      'task_4',
    );
  });

  it('reopens the alert it recovered when the station rises again within its settling runs', async () => {
    const station = watching([SENT_BACK_RISES]);

    for (const [hour, act] of [
      [1, 'approved'],
      [2, 'approved'],
      [3, 'sent-back'],
      [4, 'sent-back'],
      [5, 'approved'],
      [6, 'approved'],
      [7, 'sent-back'],
      [8, 'sent-back'],
    ] as const) {
      await station.ran(hour, act);
    }

    expect(station.kinds()).toEqual([
      'station-alert.raised',
      'station-alert.recovered',
      'station-alert.reopened',
    ]);
    expect(station.watches.held.get('station_1')?.crossings).toHaveLength(1);
  });

  it('raises a new alert once the station has stayed clear past its settling runs', async () => {
    const station = watching([SENT_BACK_RISES]);

    for (const [hour, act] of [
      [1, 'approved'],
      [2, 'approved'],
      [3, 'sent-back'],
      [4, 'sent-back'],
      [5, 'approved'],
      [6, 'approved'],
      [7, 'approved'],
      [8, 'approved'],
      [9, 'sent-back'],
      [10, 'sent-back'],
    ] as const) {
      await station.ran(hour, act);
    }

    expect(station.kinds()).toEqual([
      'station-alert.raised',
      'station-alert.recovered',
      'station-alert.raised',
    ]);
  });

  it('recovers an alert at once when the line no longer sets its threshold', async () => {
    const station = watching([
      AlertRule.of({ measure: 'sent_back_rate', above: 0.4, over: 1 }),
    ]);
    await station.ran(1, 'sent-back');

    await station.redefined([]);

    expect(station.kinds()).toEqual([
      'station-alert.raised',
      'station-alert.recovered',
    ]);
  });

  it('recovers an alert when its station leaves the line', async () => {
    const station = watching([
      AlertRule.of({ measure: 'sent_back_rate', above: 0.4, over: 1 }),
    ]);
    await station.ran(1, 'sent-back');

    await station.redefined(null);

    expect(station.kinds()).toEqual([
      'station-alert.raised',
      'station-alert.recovered',
    ]);
  });

  it('takes the team and the alert’s task in hand before asking whether they were forgotten', async () => {
    const station = watching([
      AlertRule.of({ measure: 'sent_back_rate', above: 0.4, over: 1 }),
    ]);

    await station.ran(1, 'sent-back');

    expect(station.forgotten.holds).toEqual([
      `${WORKSPACE.value} team_1`,
      `${WORKSPACE.value} team_1 task_1`,
    ]);
  });

  it('raises nothing on a run whose task was forgotten while it was read', async () => {
    const station = watching([
      AlertRule.of({ measure: 'sent_back_rate', above: 0.4, over: 1 }),
    ]);
    await station.forgotten.forgetTask(WORKSPACE, TaskId.of('task_1'));

    await station.ran(1, 'sent-back');

    expect(station.kinds()).toEqual([]);
  });

  it('keeps no watch on a station that sets no alerts', async () => {
    const station = watching(null);

    await station.ran(1, 'sent-back');

    expect(station.watches.held.size).toBe(0);
  });

  it('watches nothing for a run whose task was forgotten', async () => {
    const station = watching([
      AlertRule.of({ measure: 'sent_back_rate', above: 0.4, over: 1 }),
    ]);
    await station.forgotten.forgetWorkspace(WORKSPACE);

    await station.ran(1, 'sent-back');

    expect(station.watches.held.size).toBe(0);
  });

  it('reads an accepted rate only from runs a person acted on, so a newest run nobody answered yet trips nothing', async () => {
    const station = watching([
      AlertRule.of({ measure: 'accepted_rate', fallsBy: 0.5, over: 2 }),
    ]);

    for (const hour of [1, 2, 3, 4]) {
      await station.ran(hour, 'approved');
    }
    await station.ended(5);

    expect(station.kinds()).toEqual([]);
  });

  it('recovers once a person accepts a run that ended unanswered', async () => {
    const station = watching([
      AlertRule.of({ measure: 'accepted_rate', below: 0.5, over: 1 }),
    ]);

    await station.ran(1, 'sent-back');
    await station.ended(2);
    expect(station.kinds()).toEqual(['station-alert.raised']);

    await station.actedOn(2, 'approved');

    expect(station.kinds()).toEqual([
      'station-alert.raised',
      'station-alert.recovered',
    ]);
  });

  it('reads the merged rate once pull requests close, raising on one closed unmerged and recovering on one merged', async () => {
    const station = watching([
      AlertRule.of({ measure: 'merged_rate', below: 0.5, over: 1 }),
    ]);

    await station.ended(1);
    expect(station.kinds()).toEqual([]);

    await station.delivered(1, false);
    expect(station.kinds()).toEqual(['station-alert.raised']);

    await station.ended(3);
    await station.delivered(3, true);

    expect(station.kinds()).toEqual([
      'station-alert.raised',
      'station-alert.recovered',
    ]);
  });

  it('keeps an alert forgotten once its task is, even when a check read before the forgetting saves after it', async () => {
    const station = watching([
      AlertRule.of({ measure: 'accepted_rate', below: 0.5, over: 1 }),
    ]);
    await station.ran(1, 'sent-back');
    const stale = await station.watches.of('station_1');

    for (const stationId of await station.watches.stationsHolding(
      TaskId.of('task_1'),
    )) {
      const watch = await station.watches.of(stationId, TaskId.of('task_1'));
      await station.watches.save(
        (watch as StationWatch).withoutTask(TaskId.of('task_1')),
      );
    }

    await expect(
      station.watches.save(
        (stale as StationWatch).checked([], day('2026-09-30', 23), () =>
          AlertId.of('alert_9'),
        ),
      ),
    ).rejects.toBeInstanceOf(StationWatchMovedOnError);
    expect((await station.watches.of('station_1'))?.crossings).toEqual([]);
  });
});
