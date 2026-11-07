import { StationAlertStatesInMemory } from '@insights/alerts.fake-spec';
import type { PeoplePort } from '@insights/application/ports/people.port';
import { ReadStationAlertHandler } from '@insights/application/queries/handlers/read-station-alert.handler';
import { ReadStationAlertQuery } from '@insights/application/queries/read-station-alert.query';
import { InsightsAccess } from '@insights/application/services/insights-access.service';
import { StationAlertState } from '@insights/domain/aggregates/station-alert-state.aggregate';
import { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import { AlertRule } from '@insights/domain/value-objects/alert-rule.vo';
import { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import { day } from '@insights/insights.fake-spec';
import {
  costedRecord,
  FIRST_CONFIG,
  RunRecordsInMemory,
  SECOND_CONFIG,
  StationFactsInMemory,
  TEAM,
  WORKSPACE,
} from '@insights/runs.fake-spec';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T15:00:00.000Z');

const ADA = PersonPrincipal.of(UserId.of('user_ada'));

const STRANGER = PersonPrincipal.of(UserId.of('user_eve'));

const people: PeoplePort = {
  viewerOf: async (_teamId, principal) =>
    principal.kind === 'person' &&
    principal.userId.equals(UserId.of('user_ada'))
      ? { workspaceId: WorkspaceId.of('ws_1'), by: principal.userId }
      : null,
  namesOf: async (ids) => new Map(ids.map((each) => [each, `Name of ${each}`])),
};

const seeded = async (
  more: readonly (readonly [
    string,
    number,
    string,
    'sonnet' | 'opus',
    'accepted' | 'sent-back',
  ])[] = [],
) => {
  const records = new RunRecordsInMemory();

  for (const [runId, hour, fingerprint, model, act] of [
    ['run_1', 9, FIRST_CONFIG, 'sonnet', 'sent-back'],
    ['run_2', 10, FIRST_CONFIG, 'sonnet', 'accepted'],
    ['run_3', 11, SECOND_CONFIG, 'opus', 'accepted'],
    ['run_4', 12, SECOND_CONFIG, 'opus', 'accepted'],
    ...more,
  ] as const) {
    await records.add(
      costedRecord(runId, {
        taskId: `task_${runId}`,
        fingerprint,
        model,
        amount: model === 'opus' ? 2 : 1,
        startedAt: day('2026-09-29', hour),
        endedAt: day('2026-09-29', hour),
        changedLines: model === 'opus' ? 500 : 10,
      }).recordAction(HumanAction.of(act, day('2026-09-29', hour))),
    );
  }

  return { records };
};

describe('ReadStationAlertHandler', () => {
  const alerted = async () => {
    const { records } = await seeded();
    const alertStates = new StationAlertStatesInMemory();
    const rule = AlertRule.of({
      measure: 'sent_back_rate',
      above: 0.4,
      over: 2,
    });
    const alertState = StationAlertState.start({
      workspaceId: WORKSPACE,
      teamId: TEAM,
      lineId: LineId.of('line_1'),
      stationId: StationId.of('station_1'),
    }).check(
      [
        {
          rule,
          reading: {
            value: 0.6,
            baseline: null,
            runId: RunId.of('run_2'),
            taskId: TaskId.of('task_run_2'),
          },
        },
      ],
      day('2026-09-29', 10),
      () => AlertId.of('alert_1'),
    );
    await alertStates.add(alertState);

    return new ReadStationAlertHandler(
      new InsightsAccess(people),
      new StationFactsInMemory(records, { alertStates }),
      { now: () => NOW, sleep: async () => {} },
    );
  };

  it('reads the alert rule that fired and the measure run by run around it, its own run pinned to the reading it fired on', async () => {
    const handler = await alerted();

    const alert = await handler.execute(
      new ReadStationAlertQuery('team_1', ADA, 'alert_1'),
    );

    expect(alert.rule).toEqual({
      measure: 'sent_back_rate',
      risesBy: null,
      fallsBy: null,
      above: 0.4,
      below: null,
      over: 2,
    });
    expect(alert.taskId).toBe('task_run_2');
    expect(alert.insightsPeriod).toBe('7d');
    expect(alert.series.map((each) => [each.runId, each.value])).toEqual([
      ['run_1', null],
      ['run_2', 0.6],
      ['run_3', 0],
      ['run_4', 0],
    ]);
  });

  it('finds no alert of another team, nor one that never fired', async () => {
    const handler = await alerted();

    await expect(
      handler.execute(new ReadStationAlertQuery('team_1', ADA, 'alert_9')),
    ).rejects.toMatchObject({ kind: 'not-found' });
    await expect(
      handler.execute(new ReadStationAlertQuery('team_1', STRANGER, 'alert_1')),
    ).rejects.toMatchObject({ kind: 'not-found' });
  });
});
