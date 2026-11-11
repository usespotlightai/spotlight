import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationConnectionRosterPort } from '@integrations/application/ports/integration-connection-roster.port';
import type { IntegrationRuntimePort } from '@integrations/application/ports/integration-runtime.port';
import { ListIntegrationConnectionsHandler } from '@integrations/application/queries/handlers/list-integration-connections.handler';
import { ListIntegrationConnectionsQuery } from '@integrations/application/queries/list-integration-connections.query';
import { PersonToolPolicy } from '@integrations/domain/aggregates/person-tool-policy.aggregate';
import { actionNamed } from '@integrations/domain/value-objects/action.fake-spec';
import { ActsAs } from '@integrations/domain/value-objects/acts-as.vo';
import { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { Integration } from '@integrations/domain/value-objects/integration.vo';
import { OfferedTools } from '@integrations/domain/value-objects/offered-tools.vo';
import { PersonToolRule } from '@integrations/domain/value-objects/person-tool-rule.vo';
import { ProvidedTool } from '@integrations/domain/value-objects/provided-tool.vo';
import { ToolBacking } from '@integrations/domain/value-objects/tool-backing.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { InMemoryPersonToolPolicies } from '@integrations/integrations.policies.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it, vi } from 'vitest';

const AT = new Date('2026-10-05T10:00:00.000Z');

const policies = new InMemoryPersonToolPolicies();

const listing = (membership: { isAdmin: boolean } | null) =>
  new ListIntegrationConnectionsHandler(
    {
      inWorkspaceOfTeam: vi.fn(async () => membership),
    } as unknown as WorkspaceAccessPort,
    {
      ofTeam: async () => [
        {
          integration: IntegrationKey.of('linear'),
          personId: UserId.of('user_1'),
          linkedAccount: '@me',
          connectedAt: AT,
        },
        {
          integration: IntegrationKey.of('linear'),
          personId: UserId.of('user_2'),
          linkedAccount: '@bob',
          connectedAt: AT,
        },
      ],
    } satisfies IntegrationConnectionRosterPort,
    {
      find: vi.fn(),
      findMany: async () =>
        new Map([
          ['user_1', { id: UserId.of('user_1'), name: 'Me', image: null }],
          ['user_2', { id: UserId.of('user_2'), name: 'Bob', image: null }],
        ]),
    } satisfies PersonReaderPort,
    {
      ofTeam: async () => [
        {
          integration: 'linear',
          tools: ['linear.comment', 'linear.issue-create'],
        },
      ],
    } as unknown as DefinedIntegrationsPort,
    policies,
    {
      offered: () => [
        OfferedTools.listed(
          Integration.of({
            key: IntegrationKey.of('linear'),
            connectsOver: 'oauth2',
            actsAs: ActsAs.requester(),
            apiSpecs: ['openapi'],
            actions: DefinedActions.of([actionNamed('comment')]),
            writtenTools: [
              ProvidedTool.of({
                integration: IntegrationKey.of('linear'),
                name: 'comment',
                description: 'comment',
                backing: ToolBacking.action('comment'),
              }),
            ],
          }),
          ToolName.parsedAll(['linear.comment', 'linear.issue-create']),
          ContentHash.of('a'.repeat(64)),
        ),
      ],
    } as unknown as IntegrationRuntimePort,
  );

const query = () => new ListIntegrationConnectionsQuery('team_1', 'user_1');

describe('ListIntegrationConnectionsHandler', () => {
  it('shows a member only their own connections, with their rule for each tool', async () => {
    await policies.save(
      PersonToolPolicy.none({
        teamId: TeamId.of('team_1'),
        personId: UserId.of('user_1'),
        integration: IntegrationKey.of('linear'),
      }).set(ToolName.of('linear.comment'), PersonToolRule.of('blocked')),
    );

    expect(await listing({ isAdmin: false }).execute(query())).toEqual({
      mine: [
        {
          integration: 'linear',
          linkedAccount: '@me',
          connectedAt: AT,
          tools: [
            { tool: 'linear.comment', rule: 'blocked' },
            { tool: 'linear.issue-create', rule: 'allowed' },
          ],
        },
      ],
      people: null,
    });
  });

  it('shows an admin who has connected what, by name', async () => {
    const listed = await listing({ isAdmin: true }).execute(query());

    expect(
      listed?.people?.map((each) => [each.name, each.linkedAccount]),
    ).toEqual([
      ['Me', '@me'],
      ['Bob', '@bob'],
    ]);
  });

  it('shows nothing to someone off the team', async () => {
    expect(await listing(null).execute(query())).toBeNull();
  });
});
