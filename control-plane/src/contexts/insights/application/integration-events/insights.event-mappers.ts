import type { StationAlertFired } from '@insights/domain/events/station-alert-fired.event';
import {
  STATION_ALERT_FIRED,
  type StationAlertFiredIntegrationEvent,
} from '@shared-kernel/application/integration-events/station-alert-fired.integration-event';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';

export const INSIGHTS_EVENT_MAPPERS = [
  mapping<StationAlertFired>(
    'station-alert.fired',
    (event): StationAlertFiredIntegrationEvent => ({
      kind: STATION_ALERT_FIRED,
      alertId: event.alertId.value,
      workspaceId: event.workspaceId.value,
      teamId: event.teamId.value,
      stationId: event.stationId.value,
    }),
  ),
] as const;
