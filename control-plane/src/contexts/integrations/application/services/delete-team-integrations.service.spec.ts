import { DeleteTeamIntegrations } from '@integrations/application/services/delete-team-integrations.service';
import type { HookDefinition } from '@integrations/domain/aggregates/hook-definition.aggregate';
import type { IntegrationConnection } from '@integrations/domain/aggregates/integration-connection.aggregate';
import type { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import type { OAuth2ClientRegistration } from '@integrations/domain/aggregates/oauth2-client-registration.aggregate';
import type { HookDefinitionRepository } from '@integrations/domain/repositories/hook-definition.repository';
import type { IntegrationConnectionRepository } from '@integrations/domain/repositories/integration-connection.repository';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import type { OAuth2ClientRegistrationRepository } from '@integrations/domain/repositories/oauth2-client-registration.repository';
import { InMemoryInferredOutputSchemas } from '@integrations/integrations.inferred.fake-spec';
import { InMemoryPersonToolPolicies } from '@integrations/integrations.policies.fake-spec';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');

const WORKSPACE = WorkspaceId.of('workspace_1');

const setUp = () => {
  const hook = {
    delete: vi.fn(() => 'deleted hook'),
  } as unknown as HookDefinition;
  const integration = {
    cascadeDelete: vi.fn(() => 'deleted integration'),
  } as unknown as IntegrationDefinition;
  const connection = {} as IntegrationConnection;
  const registration = {} as OAuth2ClientRegistration;
  const hooks = {
    withId: vi.fn(),
    of: vi.fn(),
    ofTeam: vi.fn(async () => [hook, hook]),
    save: vi.fn(async () => {}),
  } satisfies HookDefinitionRepository;
  const definitions = {
    withId: vi.fn(),
    of: vi.fn(),
    ofTeam: vi.fn(async () => [integration]),
    save: vi.fn(async () => {}),
  } satisfies IntegrationDefinitionRepository;
  const connections = {
    ofTeam: vi.fn(async () => [connection]),
    remove: vi.fn(async () => {}),
  } as unknown as IntegrationConnectionRepository;
  const registrations = {
    ofTeam: vi.fn(async () => [registration]),
    remove: vi.fn(async () => {}),
  } as unknown as OAuth2ClientRegistrationRepository;

  return {
    hook,
    integration,
    connection,
    registration,
    hooks,
    definitions,
    connections,
    registrations,
    deleting: new DeleteTeamIntegrations(
      definitions,
      hooks,
      connections,
      registrations,
      new InMemoryInferredOutputSchemas(),
      new InMemoryPersonToolPolicies(),
    ),
  };
};

describe('DeleteTeamIntegrations', () => {
  it('deletes each hook of a deleted team through the hook, as Spotlight', async () => {
    const { deleting, hook, hooks } = setUp();

    await deleting.deleteHooks(TEAM, WORKSPACE);

    expect(hook.delete).toHaveBeenCalledWith(ChangeActor.spotlight(WORKSPACE));
    expect(hooks.save).toHaveBeenCalledTimes(2);
    expect(hooks.save).toHaveBeenCalledWith('deleted hook');
  });

  it('deletes each integration of a deleted team, whatever enables its tools', async () => {
    const { deleting, integration, definitions } = setUp();

    await deleting.deleteIntegrations(TEAM, WORKSPACE);

    expect(integration.cascadeDelete).toHaveBeenCalledWith(
      ChangeActor.spotlight(WORKSPACE),
    );
    expect(definitions.save).toHaveBeenCalledWith('deleted integration');
  });

  it('removes each connection and client registration of a deleted team at its version', async () => {
    const { deleting, connection, connections, registration, registrations } =
      setUp();

    await deleting.disconnectConnections(TEAM);
    await deleting.removeClientRegistrations(TEAM);

    expect(connections.remove).toHaveBeenCalledWith(connection);
    expect(registrations.remove).toHaveBeenCalledWith(registration);
  });
});
