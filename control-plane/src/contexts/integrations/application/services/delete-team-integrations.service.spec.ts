import { DeleteTeamIntegrations } from '@integrations/application/services/delete-team-integrations.service';
import type { HookDefinition } from '@integrations/domain/aggregates/hook-definition.aggregate';
import type { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { HookDeletionRequested } from '@integrations/domain/events/hook-deletion-requested.event';
import { IntegrationDeletionRequested } from '@integrations/domain/events/integration-deletion-requested.event';
import type { HookDefinitionRepository } from '@integrations/domain/repositories/hook-definition.repository';
import type { IntegrationConnectionRepository } from '@integrations/domain/repositories/integration-connection.repository';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import type { OAuth2ClientRegistrationRepository } from '@integrations/domain/repositories/oauth2-client-registration.repository';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import { InMemoryInferredOutputSchemas } from '@integrations/integrations.inferred.fake-spec';
import { InMemoryPersonToolPolicies } from '@integrations/integrations.policies.fake-spec';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');

const WORKSPACE = WorkspaceId.of('workspace_1');

const HOOK_ID = HookDefinitionId.of('hook_1');

const INTEGRATION_ID = IntegrationDefinitionId.of('integration_1');

const setUp = ({ gone = false } = {}) => {
  const hook = {
    id: HOOK_ID,
    cascadeDelete: vi.fn(() => 'deleted hook'),
  } as unknown as HookDefinition;
  const integration = {
    id: INTEGRATION_ID,
    cascadeDelete: vi.fn(() => 'deleted integration'),
  } as unknown as IntegrationDefinition;
  const hooks = {
    withId: vi.fn(async () => (gone ? null : hook)),
    of: vi.fn(),
    ofTeam: vi.fn(async () => [hook]),
    save: vi.fn(async () => {}),
  } satisfies HookDefinitionRepository;
  const definitions = {
    withId: vi.fn(async () => (gone ? null : integration)),
    of: vi.fn(),
    ofTeam: vi.fn(async () => [integration]),
    save: vi.fn(async () => {}),
  } satisfies IntegrationDefinitionRepository;

  return {
    hook,
    integration,
    hooks,
    definitions,
    deleting: new DeleteTeamIntegrations(
      definitions,
      hooks,
      {
        deleteForTeam: async () => {},
      } as unknown as IntegrationConnectionRepository,
      {
        deleteForTeam: async () => {},
      } as unknown as OAuth2ClientRegistrationRepository,
      new InMemoryInferredOutputSchemas(),
      new InMemoryPersonToolPolicies(),
    ),
  };
};

describe('DeleteTeamIntegrations', () => {
  it('makes one pending deletion for each hook and integration of a deleted team, changing none yet', async () => {
    const { deleting, hooks, definitions } = setUp();

    await expect(deleting.pendingDeletions(TEAM, WORKSPACE)).resolves.toEqual([
      new HookDeletionRequested(HOOK_ID, WORKSPACE),
      new IntegrationDeletionRequested(INTEGRATION_ID, WORKSPACE),
    ]);
    expect(hooks.save).not.toHaveBeenCalled();
    expect(definitions.save).not.toHaveBeenCalled();
  });

  it('deletes one hook at a time, as Spotlight', async () => {
    const { deleting, hook, hooks } = setUp();

    await deleting.deleteHook(HOOK_ID, WORKSPACE);

    expect(hook.cascadeDelete).toHaveBeenCalledWith(
      Attribution.spotlight(WORKSPACE),
    );
    expect(hooks.save).toHaveBeenCalledWith('deleted hook');
  });

  it('deletes one integration at a time, as Spotlight', async () => {
    const { deleting, integration, definitions } = setUp();

    await deleting.deleteIntegration(INTEGRATION_ID, WORKSPACE);

    expect(integration.cascadeDelete).toHaveBeenCalledWith(
      Attribution.spotlight(WORKSPACE),
    );
    expect(definitions.save).toHaveBeenCalledWith('deleted integration');
  });

  it('does nothing for what is already gone, so a deletion received twice is harmless', async () => {
    const { deleting, hooks, definitions } = setUp({ gone: true });

    await deleting.deleteHook(HOOK_ID, WORKSPACE);
    await deleting.deleteIntegration(INTEGRATION_ID, WORKSPACE);

    expect(hooks.save).not.toHaveBeenCalled();
    expect(definitions.save).not.toHaveBeenCalled();
  });
});
