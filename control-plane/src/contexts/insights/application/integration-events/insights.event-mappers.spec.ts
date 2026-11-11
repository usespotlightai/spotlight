import { INSIGHTS_EVENT_MAPPERS } from '@insights/application/integration-events/insights.event-mappers';
import { StationAlertFired } from '@insights/domain/events/station-alert-fired.event';
import { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const published = (event: StationAlertFired) =>
  INSIGHTS_EVENT_MAPPERS.filter((each) => each.from === event.kind).map(
    (each) => each.map(event, new Date()),
  );

describe('INSIGHTS_EVENT_MAPPERS', () => {
  it('publishes a station alert that fired, for the station it fired at', () => {
    expect(
      published(
        new StationAlertFired(
          AlertId.of('alert_1'),
          WorkspaceId.of('ws_1'),
          TeamId.of('team_1'),
          StationId.of('station_build'),
          TaskId.of('task_1'),
          RunId.of('run_1'),
        ),
      ),
    ).toEqual([
      {
        kind: 'insights.station-alert-fired.v1',
        alertId: 'alert_1',
        workspaceId: 'ws_1',
        teamId: 'team_1',
        stationId: 'station_build',
      },
    ]);
  });
});
