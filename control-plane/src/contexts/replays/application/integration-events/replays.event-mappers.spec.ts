import { REPLAYS_EVENT_MAPPERS } from '@replays/application/integration-events/replays.event-mappers';
import { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const published = (event: DomainEvent) =>
  REPLAYS_EVENT_MAPPERS.filter((each) => each.from === event.kind).map((each) =>
    each.map(event, new Date()),
  );

describe('REPLAYS_EVENT_MAPPERS', () => {
  it('publishes an opened config pull request with the station config it proposes', () => {
    expect(
      published(
        new ConfigPullRequestOpened(
          ConfigPullRequestId.of('pr_1'),
          WorkspaceId.of('ws_1'),
          TeamId.of('team_1'),
          'station_1',
          StationFingerprint.of('e'.repeat(64)),
          PullRequestUrl.of('https://github.com/acme/platform/pull/7'),
          new Date('2026-10-07T09:00:00.000Z'),
        ),
      ),
    ).toEqual([
      {
        kind: 'replays.config-pull-request-opened.v1',
        configPullRequestId: 'pr_1',
        workspaceId: 'ws_1',
        teamId: 'team_1',
        stationId: 'station_1',
        fingerprint: 'e'.repeat(64),
        url: 'https://github.com/acme/platform/pull/7',
        at: '2026-10-07T09:00:00.000Z',
      },
    ]);
  });
});
