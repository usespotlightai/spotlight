import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { DisconnectHostCommand } from '@integrations/application/commands/disconnect-host.command';
import { DisconnectHostHandler } from '@integrations/application/commands/handlers/disconnect-host.handler';
import { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { InMemoryHostConnections } from '@integrations/integrations.connections.fake-spec';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');
const LINEAR = SourceKey.of('linear');

const linked = (holder: ConnectionHolder) => {
  const connection = HostConnection.linkedFrom({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TEAM,
    source: LINEAR,
    holder,
    grant: HostGrant.of({ accessToken: 'lin-1' }),
  });
  connection.pullEvents();
  return connection;
};

const disconnecting = (member = true) => {
  const connections = new InMemoryHostConnections();
  connections.hold(linked(ConnectionHolder.person(UserId.of('user_1'))));
  connections.hold(linked(ConnectionHolder.person(UserId.of('user_2'))));
  connections.hold(linked(ConnectionHolder.team()));

  return {
    connections,
    handler: new DisconnectHostHandler(
      {
        onTeam: async () => (member ? {} : null),
      } as unknown as WorkspaceAccessPort,
      connections,
      { run: (work: () => Promise<unknown>) => work() } as TransactionPort,
    ),
  };
};

describe('DisconnectHostHandler', () => {
  it('removes only the caller’s own connection, and says so', async () => {
    const { handler, connections } = disconnecting();

    expect(
      await handler.execute(
        new DisconnectHostCommand('team_1', 'linear', 'user_1'),
      ),
    ).toBe(true);

    expect(
      await connections.of(
        TEAM,
        LINEAR,
        ConnectionHolder.person(UserId.of('user_1')),
      ),
    ).toBeNull();
    expect(
      await connections.of(
        TEAM,
        LINEAR,
        ConnectionHolder.person(UserId.of('user_2')),
      ),
    ).not.toBeNull();
    expect(
      await connections.of(TEAM, LINEAR, ConnectionHolder.team()),
    ).not.toBeNull();
    expect(connections.events.map((each) => each.kind)).toEqual([
      'integrations.host-disconnected',
    ]);
  });

  it('refuses someone off the team', async () => {
    const { handler } = disconnecting(false);

    expect(
      await handler.execute(
        new DisconnectHostCommand('team_1', 'linear', 'user_1'),
      ),
    ).toBe(false);
  });
});
