import type { LaidOutStation } from '@lines/domain/events/laid-out-station';
import type { LineCreated } from '@lines/domain/events/line-created.event';
import type { LineDeleted } from '@lines/domain/events/line-deleted.event';
import type { LineUpdated } from '@lines/domain/events/line-updated.event';
import {
  type LaidOutStation as LaidOutStationContract,
  LINE_CHANGED,
  type LineChangedIntegrationEvent,
} from '@shared-kernel/application/integration-events/line-changed.integration-event';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';

const laidOut = (station: LaidOutStation): LaidOutStationContract => ({
  id: station.id.value,
  key: station.key.value,
  name: station.name.value,
  kind: station.kind,
  color: station.color.value,
  position: station.position,
});

const lineChanged = (
  event: LineCreated | LineUpdated | LineDeleted,
): LineChangedIntegrationEvent => ({
  kind: LINE_CHANGED,
  lineId: event.lineId.value,
  workspaceId: event.workspaceId.value,
  teamId: event.teamId.value,
  version: event.version,
  lineKey: event.key.value,
  lineName: event.name.value,
  deleted: event.kind === 'line.deleted',
  stations: event.kind === 'line.deleted' ? [] : event.stations.map(laidOut),
  stationIds:
    event.kind === 'line.created'
      ? event.stations.map((each) => each.id.value)
      : event.stationIds.map((each) => each.value),
});

export const LINES_EVENT_MAPPERS = [
  mapping<LineCreated>('line.created', lineChanged),
  mapping<LineUpdated>('line.updated', lineChanged),
  mapping<LineDeleted>('line.deleted', lineChanged),
];
