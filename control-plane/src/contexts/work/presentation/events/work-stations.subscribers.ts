import {
  LINE_CHANGED,
  type LineChangedIntegrationEvent,
} from '@shared-kernel/application/integration-events/line-changed.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  PROJECT_LINE_STATIONS,
  type ProjectLineStations,
} from '@work/application/events/handlers/project-line-stations.handler';
import type { ProjectedLine } from '@work/application/ports/work-stations.port';

const projectedLineOf = (
  event: LineChangedIntegrationEvent,
): ProjectedLine => ({
  lineId: LineId.of(event.lineId),
  workspaceId: WorkspaceId.of(event.workspaceId),
  teamId: TeamId.of(event.teamId),
  version: event.version,
  key: event.lineKey,
  name: event.lineName,
  stations: event.stations.map((each) => ({
    id: StationId.of(each.id),
    key: each.key,
    name: each.name,
    kind: each.kind,
    color: each.color,
    position: each.position,
  })),
});

export const workStationSubscribers = (
  projecting: ProjectLineStations,
): readonly DomainEventSubscriber[] => [
  subscribing<LineChangedIntegrationEvent>(
    PROJECT_LINE_STATIONS,
    [LINE_CHANGED],
    (event) => projecting.lineChanged(projectedLineOf(event)),
  ),
];
