import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { HostConnectionRosterPort } from '@integrations/application/ports/host-connection-roster.port';
import { ListHostConnectionsHandler } from '@integrations/application/queries/handlers/list-host-connections.handler';
import { ListHostConnectionsQuery } from '@integrations/application/queries/list-host-connections.query';
import { PersonToolPolicy } from '@integrations/domain/aggregates/person-tool-policy.aggregate';
import { PersonToolRule } from '@integrations/domain/value-objects/person-tool-rule.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { InMemoryPersonToolPolicies } from '@integrations/integrations.policies.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it, vi } from 'vitest';

const AT = new Date('2026-10-05T10:00:00.000Z');

const policies = new InMemoryPersonToolPolicies();

const listing = (membership: { administers: boolean } | null) =>
  new ListHostConnectionsHandler(
    { onTeam: vi.fn(async () => membership) } as unknown as WorkspaceAccessPort,
    {
      ofTeam: async () => [
        {
          source: 'linear',
          personId: 'user_1',
          handle: '@me',
          connectedAt: AT,
        },
        {
          source: 'linear',
          personId: 'user_2',
          handle: '@bob',
          connectedAt: AT,
        },
      ],
    } satisfies HostConnectionRosterPort,
    {
      find: vi.fn(),
      findMany: async () =>
        new Map([
          ['user_1', { id: 'user_1', name: 'Me', image: null }],
          ['user_2', { id: 'user_2', name: 'Bob', image: null }],
        ]),
    } satisfies PersonReaderPort,
    {
      ofTeam: async () => [
        {
          source: 'linear',
          offers: ['linear.comment', 'linear.issue-create'],
        },
      ],
    } as unknown as DefinedIntegrationsPort,
    policies,
  );

const query = () => new ListHostConnectionsQuery('team_1', 'user_1');

describe('ListHostConnectionsHandler', () => {
  it('shows a member only their own connections, with their rule for each tool', async () => {
    await policies.save(
      PersonToolPolicy.none({
        teamId: TeamId.of('team_1'),
        personId: UserId.of('user_1'),
        source: SourceKey.of('linear'),
      }).set(ToolName.of('linear.comment'), PersonToolRule.of('blocked')),
    );

    expect(await listing({ administers: false }).execute(query())).toEqual({
      mine: [
        {
          source: 'linear',
          handle: '@me',
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
    const listed = await listing({ administers: true }).execute(query());

    expect(listed?.people?.map((each) => [each.name, each.handle])).toEqual([
      ['Me', '@me'],
      ['Bob', '@bob'],
    ]);
  });

  it('shows nothing to someone off the team', async () => {
    expect(await listing(null).execute(query())).toBeNull();
  });
});
