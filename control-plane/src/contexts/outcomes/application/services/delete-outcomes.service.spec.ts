import { deletionsInMemory } from '@outcomes/application/ports/deletions.fake-spec';
import {
  DeleteOutcomes,
  type OutcomesRepositories,
} from '@outcomes/application/services/delete-outcomes.service';
import { StationWatch } from '@outcomes/domain/aggregates/station-watch.aggregate';
import { StationWatchesInMemory } from '@outcomes/domain/alerts.fake-spec';
import { StationWatchVersionConflictError } from '@outcomes/domain/exceptions/station-watch-version-conflict.error';
import { TEAM, WORKSPACE } from '@outcomes/domain/outcomes.fake-spec';
import { AlertId } from '@outcomes/domain/value-objects/alert-id.vo';
import { AlertRule } from '@outcomes/domain/value-objects/alert-rule.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const TASK = TaskId.of('task_1');

const FAILING = AlertRule.of({ measure: 'failed_rate', above: 0.5, over: 1 });

const raisedAt = (stationId: string): StationWatch =>
  StationWatch.start({
    workspaceId: WORKSPACE,
    teamId: TEAM,
    lineId: 'line_1',
    stationId,
  }).check(
    [
      {
        rule: FAILING,
        reading: {
          value: 1,
          baseline: null,
          runId: RunId.of(`run_${stationId}`),
          taskId: TASK,
        },
      },
    ],
    new Date('2026-09-30T10:00:00.000Z'),
    () => AlertId.of(`alert_${stationId}`),
  );

class WatchesMovingOn extends StationWatchesInMemory {
  constructor(private readonly movingOn: string) {
    super();
  }

  override async save(watch: StationWatch): Promise<void> {
    if (watch.station.stationId === this.movingOn) {
      throw new StationWatchVersionConflictError(watch.station.stationId);
    }
    await super.save(watch);
  }
}

const deleting = async (watches: StationWatchesInMemory) => {
  const deletions = deletionsInMemory();
  let transactions = 0;

  await watches.add(raisedAt('station_1'));
  await watches.add(raisedAt('station_2'));

  const outcomes = new DeleteOutcomes(
    { watches, deletions } as unknown as OutcomesRepositories,
    {
      inTransaction: <T>(work: () => Promise<T>) => {
        transactions += 1;
        return work();
      },
    },
  );

  return { outcomes, deletions, transactions: () => transactions };
};

describe('DeleteOutcomes', () => {
  it('deletes a task’s alerts one station watch at a time, after marking the task deleted', async () => {
    const watches = new StationWatchesInMemory();
    const { outcomes, deletions, transactions } = await deleting(watches);

    await outcomes.alertsOfTask(WORKSPACE, TASK);

    expect(await deletions.isDeleted(WORKSPACE, TASK)).toBe(true);
    expect(transactions()).toBe(3);
    expect(await watches.stationsWithTask(TASK)).toEqual([]);
  });

  it('keeps the task deleted and lets a watch that changed be retried', async () => {
    const watches = new WatchesMovingOn('station_2');
    const { outcomes, deletions } = await deleting(watches);

    await expect(outcomes.alertsOfTask(WORKSPACE, TASK)).rejects.toBeInstanceOf(
      StationWatchVersionConflictError,
    );
    expect(await deletions.isDeleted(WORKSPACE, TASK)).toBe(true);
    expect(await watches.stationsWithTask(TASK)).toEqual(['station_2']);
  });

  it('marks the team as deleted as it removes its watches', async () => {
    const watches = new StationWatchesInMemory();
    const { outcomes, deletions } = await deleting(watches);

    await outcomes.alertsOfTeam(WORKSPACE, TEAM);

    expect(await deletions.isDeleted(WORKSPACE, null, TEAM)).toBe(true);
    expect(watches.stored.size).toBe(0);
  });
});
