import type { ContentHashPort } from '@lines/application/ports/content-hash.port';
import type { LaidOutStation } from '@lines/domain/events/laid-out-station';
import type { LineCreated } from '@lines/domain/events/line-created.event';
import type { LineDeleted } from '@lines/domain/events/line-deleted.event';
import type { LineUpdated } from '@lines/domain/events/line-updated.event';
import {
  type LaidOutStation as LaidOutStationContract,
  LINE_CHANGED,
  type LineChangedIntegrationEvent,
  type LineSourceCommit,
} from '@shared-kernel/application/integration-events/line-changed.integration-event';
import {
  type IntegrationEventMapper,
  mapping,
} from '@shared-kernel/application/ports/integration-event-mapper.port';

const laidOut =
  (hash: ContentHashPort) =>
  (station: LaidOutStation): LaidOutStationContract => ({
    id: station.id.value,
    key: station.key.value,
    name: station.name.value,
    kind: station.kind,
    color: station.color.value,
    position: station.position,
    rubricVersion:
      station.judge?.rubricVersion((text) => hash.sha256(text)) ?? null,
    claimsChanged: station.claimsChanged,
  });

const sourceCommitOf = (
  event: LineCreated | LineUpdated | LineDeleted,
): LineSourceCommit | null => {
  const commit = event.change.by.actor?.commit ?? null;

  return commit && event.kind !== 'line.deleted'
    ? { repository: commit.repository.value, sha: commit.sha }
    : null;
};

const lineChanged =
  (hash: ContentHashPort) =>
  (
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
    stations:
      event.kind === 'line.deleted' ? [] : event.stations.map(laidOut(hash)),
    stationIds:
      event.kind === 'line.created'
        ? event.stations.map((each) => each.id.value)
        : event.stationIds.map((each) => each.value),
    sourceCommit: sourceCommitOf(event),
  });

export const linesEventMappers = (
  hash: ContentHashPort,
): readonly IntegrationEventMapper[] => [
  mapping<LineCreated>('line.created', lineChanged(hash)),
  mapping<LineUpdated>('line.updated', lineChanged(hash)),
  mapping<LineDeleted>('line.deleted', lineChanged(hash)),
];
