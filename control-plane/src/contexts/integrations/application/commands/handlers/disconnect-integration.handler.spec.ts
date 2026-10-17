import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { DisconnectIntegrationCommand } from '@integrations/application/commands/disconnect-integration.command';
import { DisconnectIntegrationHandler } from '@integrations/application/commands/handlers/disconnect-integration.handler';
import { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { OAuthTokens } from '@integrations/domain/value-objects/oauth-tokens.vo';
import { InMemoryIntegrationConnections } from '@integrations/integrations.connections.fake-spec';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');
const LINEAR = IntegrationKey.of('linear');

const connected = (owner: ConnectionOwner) => {
  const connection = IntegrationConnection.connectFrom({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TEAM,
    integration: LINEAR,
    owner,
    tokens: OAuthTokens.of({ accessToken: 'lin-1' }),
  });
  connection.pullEvents();
  return connection;
};

const disconnecting = (member = true) => {
  const connections = new InMemoryIntegrationConnections();
  connections.add(connected(ConnectionOwner.person(UserId.of('user_1'))));
  connections.add(connected(ConnectionOwner.person(UserId.of('user_2'))));
  connections.add(connected(ConnectionOwner.team()));

  return {
    connections,
    handler: new DisconnectIntegrationHandler(
      {
        onTeam: async () => (member ? {} : null),
      } as unknown as WorkspaceAccessPort,
      connections,
      {
        inTransaction: (work: () => Promise<unknown>) => work(),
      } as TransactionPort,
    ),
  };
};

describe('DisconnectIntegrationHandler', () => {
  it('removes only the caller’s own connection, and says so', async () => {
    const { handler, connections } = disconnecting();

    expect(
      await handler.execute(
        new DisconnectIntegrationCommand('team_1', 'linear', 'user_1'),
      ),
    ).toBe(true);

    expect(
      await connections.of(
        TEAM,
        LINEAR,
        ConnectionOwner.person(UserId.of('user_1')),
      ),
    ).toBeNull();
    expect(
      await connections.of(
        TEAM,
        LINEAR,
        ConnectionOwner.person(UserId.of('user_2')),
      ),
    ).not.toBeNull();
    expect(
      await connections.of(TEAM, LINEAR, ConnectionOwner.team()),
    ).not.toBeNull();
    expect(connections.events.map((each) => each.kind)).toEqual([
      'integrations.integration-disconnected',
    ]);
  });

  it('denies someone off the team', async () => {
    const { handler } = disconnecting(false);

    expect(
      await handler.execute(
        new DisconnectIntegrationCommand('team_1', 'linear', 'user_1'),
      ),
    ).toBe(false);
  });
});
