import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { SetPersonToolRuleHandler } from '@integrations/application/commands/handlers/set-person-tool-rule.handler';
import { SetPersonToolRuleCommand } from '@integrations/application/commands/set-person-tool-rule.command';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationRuntimePort } from '@integrations/application/ports/integration-runtime.port';
import { actionNamed } from '@integrations/domain/value-objects/action.fake-spec';
import { ActsAs } from '@integrations/domain/value-objects/acts-as.vo';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import { Integration } from '@integrations/domain/value-objects/integration.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { OfferedTools } from '@integrations/domain/value-objects/offered-tools.vo';
import { ProvidedTool } from '@integrations/domain/value-objects/provided-tool.vo';
import { ToolBacking } from '@integrations/domain/value-objects/tool-backing.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { InMemoryPersonToolPolicies } from '@integrations/integrations.policies.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const LINEAR = IntegrationKey.of('linear');

const setting = (member = true, actsAs = 'requester') => {
  const policies = new InMemoryPersonToolPolicies();
  const handler = new SetPersonToolRuleHandler(
    {
      inWorkspaceOfTeam: async () => (member ? { isAdmin: false } : null),
    } as unknown as WorkspaceAccessPort,
    {
      ofTeam: async () => [
        { integration: 'linear', tools: ['linear.comment', 'linear.issue'] },
      ],
    } as unknown as DefinedIntegrationsPort,
    {
      offered: () => [
        OfferedTools.listed(
          Integration.of({
            key: LINEAR,
            connectsOver: 'oauth2',
            actsAs: actsAs === 'requester' ? ActsAs.requester() : ActsAs.team(),
            actions: DefinedActions.of([actionNamed('comment')]),
            apiSpecs: ['openapi'],
            writtenTools: ['comment', 'issue'].map((name) =>
              ProvidedTool.of({
                integration: LINEAR,
                name,
                description: name,
                backing: ToolBacking.action('comment'),
              }),
            ),
          }),
          ToolName.parsedAll([
            'linear.comment',
            'linear.issue',
            'linear.search',
          ]),
          ContentHash.of('a'.repeat(64)),
        ),
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

  it('sets a rule for a tool generated from the integration’s API spec', async () => {
    const { set, ruleOf } = setting();

    await expect(set('linear.search', 'blocked')).resolves.toBe(true);

    expect(await ruleOf('user_alice', 'linear.search')).toBe('blocked');
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
