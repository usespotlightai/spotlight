import { AbandonTeamIntegrations } from '@integrations/application/services/abandon-team-integrations.service';
import type { HookDefinition } from '@integrations/domain/aggregates/hook-definition.aggregate';
import type { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { HookAbandonmentDue } from '@integrations/domain/events/hook-abandonment-due.event';
import { IntegrationAbandonmentDue } from '@integrations/domain/events/integration-abandonment-due.event';
import type { HookDefinitionRepository } from '@integrations/domain/repositories/hook-definition.repository';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import type { OAuth2ClientRegistrationRepository } from '@integrations/domain/repositories/oauth2-client-registration.repository';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import { InMemoryLearnedOutputs } from '@integrations/integrations.learned.fake-spec';
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
    abandon: vi.fn(() => 'abandoned hook'),
  } as unknown as HookDefinition;
  const integration = {
    id: INTEGRATION_ID,
    abandon: vi.fn(() => 'abandoned integration'),
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
    abandoning: new AbandonTeamIntegrations(
      definitions,
      hooks,
      { forgetTeam: async () => {} } as unknown as HostConnectionRepository,
      {
        forgetTeam: async () => {},
      } as unknown as OAuth2ClientRegistrationRepository,
      new InMemoryLearnedOutputs(),
      new InMemoryPersonToolPolicies(),
    ),
  };
};

describe('AbandonTeamIntegrations', () => {
  it('owes one abandonment for each hook and integration a disbanded team had, changing none yet', async () => {
    const { abandoning, hooks, definitions } = setUp();

    await expect(abandoning.owed(TEAM, WORKSPACE)).resolves.toEqual([
      new HookAbandonmentDue(HOOK_ID, WORKSPACE),
      new IntegrationAbandonmentDue(INTEGRATION_ID, WORKSPACE),
    ]);
    expect(hooks.save).not.toHaveBeenCalled();
    expect(definitions.save).not.toHaveBeenCalled();
  });

  it('abandons one hook at a time, as Spotlight', async () => {
    const { abandoning, hook, hooks } = setUp();

    await abandoning.hook(HOOK_ID, WORKSPACE);

    expect(hook.abandon).toHaveBeenCalledWith(Attribution.spotlight(WORKSPACE));
    expect(hooks.save).toHaveBeenCalledWith('abandoned hook');
  });

  it('abandons one integration at a time, as Spotlight', async () => {
    const { abandoning, integration, definitions } = setUp();

    await abandoning.integration(INTEGRATION_ID, WORKSPACE);

    expect(integration.abandon).toHaveBeenCalledWith(
      Attribution.spotlight(WORKSPACE),
    );
    expect(definitions.save).toHaveBeenCalledWith('abandoned integration');
  });

  it('does nothing for what is already gone, so an abandonment heard twice is harmless', async () => {
    const { abandoning, hooks, definitions } = setUp({ gone: true });

    await abandoning.hook(HOOK_ID, WORKSPACE);
    await abandoning.integration(INTEGRATION_ID, WORKSPACE);

    expect(hooks.save).not.toHaveBeenCalled();
    expect(definitions.save).not.toHaveBeenCalled();
  });
});
