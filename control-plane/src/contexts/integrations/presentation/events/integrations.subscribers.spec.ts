import type { RefreshIntegrationSpecHandler } from '@integrations/application/commands/handlers/refresh-integration-spec.handler';
import type { DeleteTeamIntegrations } from '@integrations/application/services/delete-team-integrations.service';
import type { LifecycleHookTriggers } from '@integrations/application/services/lifecycle-hook-triggers.service';
import { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { OAuthTokens } from '@integrations/domain/value-objects/oauth-tokens.vo';
import { InMemoryInferredOutputSchemas } from '@integrations/integrations.inferred.fake-spec';
import { integrationsSubscribers } from '@integrations/presentation/events/integrations.subscribers';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const connected = (owner: ConnectionOwner) =>
  IntegrationConnection.connectFrom({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    integration: IntegrationKey.of('linear'),
    owner,
    tokens: OAuthTokens.of({ accessToken: 'lin-1' }),
  }).pullEvents()[0];

const refreshSpecOn = async (owner: ConnectionOwner) => {
  const execute = vi.fn(async () => undefined);
  const subscriber = integrationsSubscribers(
    {} as DeleteTeamIntegrations,
    {} as LifecycleHookTriggers,
    { execute } as unknown as RefreshIntegrationSpecHandler,
    new InMemoryInferredOutputSchemas(),
  ).find(
    (each) =>
      each.name === 'integrations.refresh-spec-when-an-integration-connected',
  );
  const event = connected(owner);

  if (subscriber && event) {
    await subscriber.handle(event);
  }

  return execute;
};

describe('integrationsSubscribers', () => {
  it('refreshes the spec of an integration once the team connects it', async () => {
    expect(await refreshSpecOn(ConnectionOwner.team())).toHaveBeenCalledOnce();
  });

  it('leaves the spec alone when a person connects their own account', async () => {
    expect(
      await refreshSpecOn(ConnectionOwner.person(UserId.of('user_1'))),
    ).not.toHaveBeenCalled();
  });
});
