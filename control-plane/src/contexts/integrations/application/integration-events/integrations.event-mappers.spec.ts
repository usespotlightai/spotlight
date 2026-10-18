import { INTEGRATIONS_EVENT_MAPPERS } from '@integrations/application/integration-events/integrations.event-mappers';
import { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { OAuthTokens } from '@integrations/domain/value-objects/oauth-tokens.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-10-05T10:00:00.000Z');

const published = (events: readonly DomainEvent[]) =>
  events.flatMap((event) =>
    INTEGRATIONS_EVENT_MAPPERS.filter((each) => each.from === event.kind).map(
      (each) => each.map(event, AT),
    ),
  );

const connected = (owner: ConnectionOwner) =>
  IntegrationConnection.connectFrom({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    integration: IntegrationKey.of('linear'),
    owner,
    tokens: OAuthTokens.of({ accessToken: 'lin-1' }),
  }).pullEvents();

describe('INTEGRATIONS_EVENT_MAPPERS', () => {
  it('publishes a person’s connection with who made it, and never a token', () => {
    const [event] = published(
      connected(ConnectionOwner.person(UserId.of('user_1'))),
    );

    expect(event).toEqual({
      kind: 'integrations.integration-connected.v1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      integration: 'linear',
      personId: 'user_1',
      at: AT.toISOString(),
    });
    expect(JSON.stringify(event)).not.toContain('lin-1');
  });

  it('publishes the team’s connection as nobody’s in particular', () => {
    expect(
      published(connected(ConnectionOwner.team()))[0]?.personId,
    ).toBeNull();
  });
});
