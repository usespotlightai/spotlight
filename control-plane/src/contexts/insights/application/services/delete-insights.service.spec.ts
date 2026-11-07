import { StationAlertStatesInMemory } from '@insights/alerts.fake-spec';
import { deletionsInMemory } from '@insights/application/ports/deletions.fake-spec';
import {
  DeleteInsights,
  type InsightsRepositories,
} from '@insights/application/services/delete-insights.service';
import { StationAlertState } from '@insights/domain/aggregates/station-alert-state.aggregate';
import { StationAlertStateVersionConflictError } from '@insights/domain/exceptions/station-alert-state-version-conflict.error';
import { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import { AlertRule } from '@insights/domain/value-objects/alert-rule.vo';
import { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { TEAM, WORKSPACE } from '@insights/runs.fake-spec';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const TASK = TaskId.of('task_1');

const FAILING = AlertRule.of({ measure: 'failed_rate', above: 0.5, over: 1 });

const firedAt = (stationId: string): StationAlertState =>
  StationAlertState.start({
    workspaceId: WORKSPACE,
    teamId: TEAM,
    lineId: LineId.of('line_1'),
    stationId: StationId.of(stationId),
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
    if (alertState.station.stationId.value === this.movingOn) {
      throw new StationAlertStateVersionConflictError(
        alertState.station.stationId.value,
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
    { alertStates } as unknown as InsightsRepositories,
    deletions,
    {
      inTransaction: <T>(work: () => Promise<T>) => {
        transactions += 1;
        return work();
      },
    },
  );

  return { insights, deletions, transactions: () => transactions };
};

const withTask = (alertStates: StationAlertStatesInMemory) =>
  alertStates.ofScope(DeletionScope.ofTask(WORKSPACE, TASK), 10);

describe('DeleteInsights', () => {
  it('marks the task deleted, then drops its firings from each station alert state in a transaction of its own', async () => {
    const alertStates = new StationAlertStatesInMemory();
    const { insights, deletions, transactions } = await deleting(alertStates);

    await insights.alertStates(DeletionScope.ofTask(WORKSPACE, TASK));

    expect(deletions.deleted(DeletionScope.ofTask(WORKSPACE, TASK))).toBe(true);
    expect(transactions()).toBe(3);
    expect(await withTask(alertStates)).toEqual([]);
    expect(alertStates.stored.size).toBe(2);
  });

  it('keeps what it erased when another alert state changed meanwhile, and a retry erases the rest', async () => {
    const alertStates = new AlertStatesMovingOn('station_2');
    const { insights, deletions } = await deleting(alertStates);
    const scope = DeletionScope.ofTask(WORKSPACE, TASK);

    await expect(insights.alertStates(scope)).rejects.toBeInstanceOf(
      StationAlertStateVersionConflictError,
    );

    expect(deletions.deleted(scope)).toBe(true);
    expect(
      (await withTask(alertStates)).map((each) => each.station.stationId.value),
    ).toEqual(['station_2']);
  });

  it('marks the team as deleted as it removes its alert states', async () => {
    const alertStates = new StationAlertStatesInMemory();
    const { insights, deletions } = await deleting(alertStates);

    await insights.alertStates(DeletionScope.ofTeam(WORKSPACE, TEAM));

    expect(deletions.deleted(DeletionScope.ofTeam(WORKSPACE, TEAM))).toBe(true);
    expect(alertStates.stored.size).toBe(0);
  });
});
