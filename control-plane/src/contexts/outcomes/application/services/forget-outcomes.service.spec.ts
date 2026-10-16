import { forgottenInMemory } from '@outcomes/application/ports/forgotten.fake-spec';
import {
  ForgetOutcomes,
  type OutcomesHeld,
} from '@outcomes/application/services/forget-outcomes.service';
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
  StationWatch.begun({
    workspaceId: WORKSPACE,
    teamId: TEAM,
    lineId: 'line_1',
    stationId,
  }).checked(
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

const forgetting = async (watches: StationWatchesInMemory) => {
  const forgotten = forgottenInMemory();
  let transactions = 0;

  await watches.add(raisedAt('station_1'));
  await watches.add(raisedAt('station_2'));

  const forget = new ForgetOutcomes(
    { watches, forgotten } as unknown as OutcomesHeld,
    {
      run: <T>(work: () => Promise<T>) => {
        transactions += 1;
        return work();
      },
    },
  );

  return { forget, forgotten, transactions: () => transactions };
};

describe('ForgetOutcomes', () => {
  it('forgets a task’s alerts one station watch at a time, after marking the task forgotten', async () => {
    const watches = new StationWatchesInMemory();
    const { forget, forgotten, transactions } = await forgetting(watches);

    await forget.alertsOfTask(WORKSPACE, TASK);

    expect(await forgotten.forgot(WORKSPACE, TASK)).toBe(true);
    expect(transactions()).toBe(3);
    expect(await watches.stationsHolding(TASK)).toEqual([]);
  });

  it('keeps the task forgotten and lets a watch that changed be retried', async () => {
    const watches = new WatchesMovingOn('station_2');
    const { forget, forgotten } = await forgetting(watches);

    await expect(forget.alertsOfTask(WORKSPACE, TASK)).rejects.toBeInstanceOf(
      StationWatchVersionConflictError,
    );
    expect(await forgotten.forgot(WORKSPACE, TASK)).toBe(true);
    expect(await watches.stationsHolding(TASK)).toEqual(['station_2']);
  });

  it('marks a disbanded team forgotten as it drops the team’s watches', async () => {
    const watches = new StationWatchesInMemory();
    const { forget, forgotten } = await forgetting(watches);

    await forget.alertsOfTeam(WORKSPACE, TEAM);

    expect(await forgotten.forgot(WORKSPACE, null, TEAM)).toBe(true);
    expect(watches.held.size).toBe(0);
  });
});
