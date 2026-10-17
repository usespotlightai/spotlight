import type { RereadIntegrationSourceHandler } from '@integrations/application/commands/handlers/reread-integration-source.handler';
import type { AbandonTeamIntegrations } from '@integrations/application/services/abandon-team-integrations.service';
import type { HookedHappenings } from '@integrations/application/services/hooked-happenings.service';
import { HostConnection } from '@integrations/domain/aggregates/host-connection.aggregate';
import { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import { HostGrant } from '@integrations/domain/value-objects/host-grant.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { InMemoryLearnedOutputs } from '@integrations/integrations.learned.fake-spec';
import { integrationsSubscribers } from '@integrations/presentation/events/integrations.subscribers';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const connected = (holder: ConnectionHolder) =>
  HostConnection.linkFrom({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    source: SourceKey.of('linear'),
    holder,
    grant: HostGrant.of({ accessToken: 'lin-1' }),
  }).pullEvents()[0];

const rereadOn = async (holder: ConnectionHolder) => {
  const execute = vi.fn(async () => undefined);
  const subscriber = integrationsSubscribers(
    {} as AbandonTeamIntegrations,
    {} as HookedHappenings,
    { execute } as unknown as RereadIntegrationSourceHandler,
    new InMemoryLearnedOutputs(),
  ).find(
    (each) => each.name === 'integrations.reread-source-when-a-host-connected',
  );
  const event = connected(holder);

  if (subscriber && event) {
    await subscriber.handle(event);
  }

  return execute;
};

describe('integrationsSubscribers', () => {
  it('rereads an integration’s description once the team connects it', async () => {
    expect(await rereadOn(ConnectionHolder.team())).toHaveBeenCalledOnce();
  });

  it('leaves the description alone when a person connects their own account', async () => {
    expect(
      await rereadOn(ConnectionHolder.person(UserId.of('user_1'))),
    ).not.toHaveBeenCalled();
  });
});
