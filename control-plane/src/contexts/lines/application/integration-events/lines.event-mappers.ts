import type { LineDeleted } from '@lines/domain/events/line-deleted.event';
import type { LineUpdated } from '@lines/domain/events/line-updated.event';
import {
  LINE_CHANGED,
  type LineChangedIntegrationEvent,
} from '@shared-kernel/application/integration-events/line-changed.integration-event';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';

const lineChanged = (
  event: LineUpdated | LineDeleted,
): LineChangedIntegrationEvent => ({
  kind: LINE_CHANGED,
  lineId: event.lineId.value,
  workspaceId: event.workspaceId.value,
  teamId: event.teamId.value,
  stationIds: event.stationIds.map((each) => each.value),
});

export const LINES_EVENT_MAPPERS = [
  mapping<LineUpdated>('line.updated', lineChanged),
  mapping<LineDeleted>('line.deleted', lineChanged),
];
