import { REPLAYS_PUBLICATIONS } from '@replays/application/integration-events/replays.publications';
import { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const published = (event: DomainEvent) =>
  REPLAYS_PUBLICATIONS.filter((each) => each.from === event.kind).map((each) =>
    each.publish(event, new Date()),
  );

describe('REPLAYS_PUBLICATIONS', () => {
  it('publishes an opened config pull request with the station config it proposes', () => {
    expect(
      published(
        new ConfigPullRequestOpened(
          ConfigPullRequestId.of('pr_1'),
          WorkspaceId.of('ws_1'),
          TeamId.of('team_1'),
          'line_1',
          'station_1',
          StationFingerprint.of('e'.repeat(64)),
          'https://github.com/acme/platform/pull/7',
          new Date('2026-10-07T09:00:00.000Z'),
        ),
      ),
    ).toEqual([
      {
        kind: 'replays.config-pull-request-opened.v1',
        configPullRequestId: 'pr_1',
        workspaceId: 'ws_1',
        teamId: 'team_1',
        lineId: 'line_1',
        stationId: 'station_1',
        fingerprint: 'e'.repeat(64),
        url: 'https://github.com/acme/platform/pull/7',
        openedAt: '2026-10-07T09:00:00.000Z',
      },
    ]);
  });
});
