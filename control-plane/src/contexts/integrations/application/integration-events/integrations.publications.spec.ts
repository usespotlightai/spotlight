import { INTEGRATIONS_PUBLICATIONS } from '@integrations/application/integration-events/integrations.publications';
import { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-10-05T10:00:00.000Z');

const published = (events: readonly DomainEvent[]) =>
  events.flatMap((event) =>
    INTEGRATIONS_PUBLICATIONS.filter((each) => each.from === event.kind).map(
      (each) => each.publish(event, AT),
    ),
  );

const linked = (holder: ConnectionHolder) =>
  HostConnection.linkedFrom({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    source: SourceKey.of('linear'),
    holder,
    grant: HostGrant.of({ accessToken: 'lin-1' }),
  }).pullEvents();

describe('INTEGRATIONS_PUBLICATIONS', () => {
  it('publishes a person’s connection with who made it, and never a token', () => {
    const [event] = published(
      linked(ConnectionHolder.person(UserId.of('user_1'))),
    );

    expect(event).toEqual({
      kind: 'integrations.host-connected.v1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      source: 'linear',
      personId: 'user_1',
      at: AT.toISOString(),
    });
    expect(JSON.stringify(event)).not.toContain('lin-1');
  });

  it('publishes the team’s connection as nobody’s in particular', () => {
    expect(published(linked(ConnectionHolder.team()))[0]?.personId).toBeNull();
  });
});
