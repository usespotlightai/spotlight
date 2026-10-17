import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { SetPersonToolRuleHandler } from '@integrations/application/commands/handlers/set-person-tool-rule.handler';
import { SetPersonToolRuleCommand } from '@integrations/application/commands/set-person-tool-rule.command';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationRuntimePort } from '@integrations/application/ports/integration-runtime.port';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { InMemoryPersonToolPolicies } from '@integrations/integrations.policies.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const setting = (member = true, actsAs = 'requester') => {
  const policies = new InMemoryPersonToolPolicies();
  const handler = new SetPersonToolRuleHandler(
    {
      onTeam: async () => (member ? { administers: false } : null),
    } as unknown as WorkspaceAccessPort,
    {
      ofTeam: async () => [
        { integration: 'linear', tools: ['linear.comment', 'linear.issue'] },
      ],
    } as unknown as DefinedIntegrationsPort,
    {
      integrations: () => [
        {
          key: IntegrationKey.of('linear'),
          actsAs: { byRequester: actsAs === 'requester' },
        },
      ],
    } as unknown as IntegrationRuntimePort,
    policies,
  );

  const set = (tool: string, rule: string, viewer = 'user_alice') =>
    handler.execute(
      new SetPersonToolRuleCommand('team_1', 'linear', tool, rule, viewer),
    );

  const ruleOf = async (viewer: string, tool: string) =>
    (
      await policies.of(
        TeamId.of('team_1'),
        UserId.of(viewer),
        IntegrationKey.of('linear'),
      )
    )?.ruleFor(ToolName.of(tool)).name ?? 'allowed';

  return { set, ruleOf };
};

describe('SetPersonToolRuleHandler', () => {
  it('sets the caller’s own rule, and only theirs', async () => {
    const { set, ruleOf } = setting();

    await expect(set('linear.comment', 'needs-approval')).resolves.toBe(true);
    await expect(set('linear.issue', 'blocked')).resolves.toBe(true);

    expect(await ruleOf('user_alice', 'linear.comment')).toBe('needs-approval');
    expect(await ruleOf('user_alice', 'linear.issue')).toBe('blocked');
    expect(await ruleOf('user_bob', 'linear.comment')).toBe('allowed');
  });

  it('finds nothing for someone off the team, a tool the integration does not offer, or an integration that acts as the team', async () => {
    await expect(setting(false).set('linear.comment', 'blocked')).resolves.toBe(
      false,
    );
    await expect(setting().set('linear.archive', 'blocked')).resolves.toBe(
      false,
    );
    await expect(
      setting(true, 'team').set('linear.comment', 'blocked'),
    ).resolves.toBe(false);
  });

  it('rejects a rule that is not one', async () => {
    await expect(
      setting().set('linear.comment', 'sometimes'),
    ).rejects.toMatchObject({ kind: 'invalid' });
  });
});
