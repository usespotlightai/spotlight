import { deletionsInMemory } from '@insights/application/ports/deletions.fake-spec';
import {
  DeleteInsights,
  type InsightsRepositories,
} from '@insights/application/services/delete-insights.service';
import { StationAlertState } from '@insights/domain/aggregates/station-alert-state.aggregate';
import { StationAlertStatesInMemory } from '@insights/domain/alerts.fake-spec';
import { StationAlertStateVersionConflictError } from '@insights/domain/exceptions/station-alert-state-version-conflict.error';
import { TEAM, WORKSPACE } from '@insights/domain/runs.fake-spec';
import { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import { AlertRule } from '@insights/domain/value-objects/alert-rule.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const TASK = TaskId.of('task_1');

const FAILING = AlertRule.of({ measure: 'failed_rate', above: 0.5, over: 1 });

const firedAt = (stationId: string): StationAlertState =>
  StationAlertState.start({
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

class AlertStatesMovingOn extends StationAlertStatesInMemory {
  constructor(private readonly movingOn: string) {
    super();
  }

  override async save(alertState: StationAlertState): Promise<void> {
    if (alertState.station.stationId === this.movingOn) {
      throw new StationAlertStateVersionConflictError(
        alertState.station.stationId,
      );
    }
    await super.save(alertState);
  }
}

const deleting = async (alertStates: StationAlertStatesInMemory) => {
  const deletions = deletionsInMemory();
  let transactions = 0;

  await alertStates.add(firedAt('station_1'));
  await alertStates.add(firedAt('station_2'));

  const insights = new DeleteInsights(
    { alertStates, deletions } as unknown as InsightsRepositories,
    {
      inTransaction: <T>(work: () => Promise<T>) => {
        transactions += 1;
        return work();
      },
    },
  );

  return { insights, deletions, transactions: () => transactions };
};

describe('DeleteInsights', () => {
  it('deletes a task’s alerts one station alert state at a time, after marking the task deleted', async () => {
    const alertStates = new StationAlertStatesInMemory();
    const { insights, deletions, transactions } = await deleting(alertStates);

    await insights.alertsOfTask(WORKSPACE, TASK);

    expect(await deletions.isDeleted(WORKSPACE, TASK)).toBe(true);
    expect(transactions()).toBe(3);
    expect(await alertStates.stationsWithTask(TASK)).toEqual([]);
  });

  it('keeps the task deleted and lets an alert state that changed be retried', async () => {
    const alertStates = new AlertStatesMovingOn('station_2');
    const { insights, deletions } = await deleting(alertStates);

    await expect(insights.alertsOfTask(WORKSPACE, TASK)).rejects.toBeInstanceOf(
      StationAlertStateVersionConflictError,
    );
    expect(await deletions.isDeleted(WORKSPACE, TASK)).toBe(true);
    expect(await alertStates.stationsWithTask(TASK)).toEqual(['station_2']);
  });

  it('marks the team as deleted as it removes its alert states', async () => {
    const alertStates = new StationAlertStatesInMemory();
    const { insights, deletions } = await deleting(alertStates);

    await insights.alertsOfTeam(WORKSPACE, TEAM);

    expect(await deletions.isDeleted(WORKSPACE, null, TEAM)).toBe(true);
    expect(alertStates.stored.size).toBe(0);
  });
});
