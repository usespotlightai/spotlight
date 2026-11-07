import { LINES_EVENT_MAPPERS } from '@lines/application/integration-events/lines.event-mappers';
import { LineCreated } from '@lines/domain/events/line-created.event';
import { LineDeleted } from '@lines/domain/events/line-deleted.event';
import { LineUpdated } from '@lines/domain/events/line-updated.event';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const RECORDED_AT = new Date('2026-10-02T09:30:00.000Z');

const published = (event: DomainEvent) =>
  LINES_EVENT_MAPPERS.filter((each) => each.from === event.kind).map((each) =>
    each.map(event, RECORDED_AT),
  );

const change = ConfigurationChange.updated(
  { resource: 'line', id: 'line_1', key: 'default' },
  changeActorIn(),
);

const STATION_IDS = [StationId.of('station_1'), StationId.of('station_2')];

const lineChanged = {
  kind: 'lines.line-changed.v1',
  lineId: 'line_1',
  workspaceId: 'ws_1',
  teamId: 'team_1',
  stationIds: ['station_1', 'station_2'],
};

describe('LINES_EVENT_MAPPERS', () => {
  it('publishes nothing about a created line', () => {
    expect(
      published(
        new LineCreated(
          LineId.of('line_1'),
          WorkspaceId.of('ws_1'),
          TeamId.of('team_1'),
          LineKey.of('default'),
          change,
        ),
      ),
    ).toEqual([]);
  });

  it('publishes which stations an updated line had and has', () => {
    expect(
      published(
        new LineUpdated(
          LineId.of('line_1'),
          WorkspaceId.of('ws_1'),
          TeamId.of('team_1'),
          LineKey.of('default'),
          change,
          STATION_IDS,
        ),
      ),
    ).toEqual([lineChanged]);
  });

  it('publishes which stations a deleted line had', () => {
    expect(
      published(
        new LineDeleted(
          LineId.of('line_1'),
          WorkspaceId.of('ws_1'),
          TeamId.of('team_1'),
          LineKey.of('default'),
          change,
          STATION_IDS,
        ),
      ),
    ).toEqual([lineChanged]);
  });
});
