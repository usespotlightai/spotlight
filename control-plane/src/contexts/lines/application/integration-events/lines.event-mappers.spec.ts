import { linesEventMappers } from '@lines/application/integration-events/lines.event-mappers';
import type { LaidOutStation } from '@lines/domain/events/laid-out-station';
import { LineCreated } from '@lines/domain/events/line-created.event';
import { LineDeleted } from '@lines/domain/events/line-deleted.event';
import { LineUpdated } from '@lines/domain/events/line-updated.event';
import { StationColor } from '@lines/domain/value-objects/station-color.vo';
import { StationJudge } from '@lines/domain/value-objects/station-judge.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { Client } from '@shared-kernel/domain/value-objects/client.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { SourceCommit } from '@shared-kernel/domain/value-objects/source-commit.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const RECORDED_AT = new Date('2026-10-02T09:30:00.000Z');

const HASH = { sha256: (text: string) => `sha256:${text.length}` };

const SHA = '3f1c9a7e5b2d4c6f8a0e1b3d5c7f9a2e4b6d8c0f';

const published = (event: DomainEvent) =>
  linesEventMappers(HASH)
    .filter((each) => each.from === event.kind)
    .map((each) => each.map(event, RECORDED_AT));

const change = ConfigurationChange.updated(
  { resource: 'line', id: 'line_1', key: 'default' },
  changeActorIn(),
);

const STATION_IDS = [StationId.of('station_1'), StationId.of('station_2')];

const LAID_OUT: readonly LaidOutStation[] = [
  {
    id: StationId.of('station_2'),
    key: StationKey.of('build'),
    name: StationName.of('Build'),
    kind: 'work',
    color: StationColor.of('#6d78d5'),
    position: 0,
    judge: null,
    claimsChanged: false,
  },
];

const JUDGE = StationJudge.of({
  claims: ['Tests pass'],
  sample: 1,
  minAgreement: 0.8,
});

const committed = ConfigurationChange.updated(
  { resource: 'line', id: 'line_1', key: 'default' },
  changeActorIn(
    'ws_1',
    Actor.of(
      PersonPrincipal.of(UserId.of('user_1')),
      Client.named('terraform-provider/0.4.0'),
      SourceCommit.named(`acme/config@${SHA}`),
    ),
  ),
);

const PUBLISHED_STATION = {
  id: 'station_2',
  key: 'build',
  name: 'Build',
  kind: 'work',
  color: '#6d78d5',
  position: 0,
  rubricVersion: null,
  claimsChanged: false,
};

const lineChanged = {
  kind: 'lines.line-changed.v1',
  lineId: 'line_1',
  workspaceId: 'ws_1',
  teamId: 'team_1',
  lineKey: 'default',
  lineName: 'Default',
};

describe('LINES_EVENT_MAPPERS', () => {
  it('publishes the stations of a created line', () => {
    expect(
      published(
        new LineCreated(
          LineId.of('line_1'),
          WorkspaceId.of('ws_1'),
          TeamId.of('team_1'),
          LineKey.of('default'),
          change,
          0,
          LineName.of('Default'),
          LAID_OUT,
        ),
      ),
    ).toEqual([
      {
        ...lineChanged,
        version: 0,
        deleted: false,
        stations: [PUBLISHED_STATION],
        stationIds: ['station_2'],
        sourceCommit: null,
      },
    ]);
  });

  it('publishes which stations an updated line had and has, and its layout', () => {
    expect(
      published(
        new LineUpdated(
          LineId.of('line_1'),
          WorkspaceId.of('ws_1'),
          TeamId.of('team_1'),
          LineKey.of('default'),
          change,
          STATION_IDS,
          3,
          LineName.of('Default'),
          LAID_OUT,
        ),
      ),
    ).toEqual([
      {
        ...lineChanged,
        version: 3,
        deleted: false,
        stations: [PUBLISHED_STATION],
        stationIds: ['station_1', 'station_2'],
        sourceCommit: null,
      },
    ]);
  });

  it('publishes which stations a deleted line had and no layout', () => {
    expect(
      published(
        new LineDeleted(
          LineId.of('line_1'),
          WorkspaceId.of('ws_1'),
          TeamId.of('team_1'),
          LineKey.of('default'),
          change,
          STATION_IDS,
          4,
          LineName.of('Default'),
        ),
      ),
    ).toEqual([
      {
        ...lineChanged,
        version: 4,
        deleted: true,
        stations: [],
        stationIds: ['station_1', 'station_2'],
        sourceCommit: null,
      },
    ]);
  });

  it('publishes the claims version of each judged station, whether its claims changed, and the commit the change came from', () => {
    const [event] = published(
      new LineUpdated(
        LineId.of('line_1'),
        WorkspaceId.of('ws_1'),
        TeamId.of('team_1'),
        LineKey.of('default'),
        committed,
        STATION_IDS,
        5,
        LineName.of('Default'),
        [{ ...LAID_OUT[0], judge: JUDGE, claimsChanged: true }],
      ),
    );

    expect(event).toMatchObject({
      stations: [
        {
          ...PUBLISHED_STATION,
          rubricVersion: `sha256:${JUDGE.criteria.length}`,
          claimsChanged: true,
        },
      ],
      sourceCommit: { repository: 'acme/config', sha: SHA },
    });
  });

  it('publishes no commit for a deleted line', () => {
    const [event] = published(
      new LineDeleted(
        LineId.of('line_1'),
        WorkspaceId.of('ws_1'),
        TeamId.of('team_1'),
        LineKey.of('default'),
        committed,
        STATION_IDS,
        6,
        LineName.of('Default'),
      ),
    );

    expect(event).toMatchObject({ sourceCommit: null });
  });
});
