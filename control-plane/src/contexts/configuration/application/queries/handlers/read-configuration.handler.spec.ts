import type {
  ConfigurationReaderPort,
  ConfigurationView,
} from '@configuration/application/ports/configuration-reader.port';
import type {
  TeamProfile,
  TeamsPort,
} from '@configuration/application/ports/teams.port';
import { ConfigurationHandler } from '@configuration/application/queries/handlers/read-configuration.handler';
import { ConfigurationQuery } from '@configuration/application/queries/read-configuration.query';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM: TeamProfile = {
  teamId: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
};

const reading = (
  over: {
    workspace?: null;
    defined?: boolean;
    linkedAccount?: string | null;
    requiresConnection?: boolean;
    spec?: boolean;
  } = {},
) =>
  new ConfigurationHandler(
    {
      viewedBy: vi.fn(async () => (over.workspace === null ? null : TEAM)),
    } satisfies TeamsPort,
    {
      of: vi.fn(
        async (): Promise<ConfigurationView> => ({
          integrations:
            over.defined === false
              ? []
              : [
                  {
                    integration: 'linear',
                    name: 'Linear',
                    path: 'integrations/linear',
                    requiresConnection: over.requiresConnection ?? false,
                    actsAs: 'team',
                    connected: over.linkedAccount !== undefined,
                    linkedAccount: over.linkedAccount ?? null,
                    spec: over.spec
                      ? {
                          kind: 'openapi',
                          tools: 19,
                          readAt: new Date('2026-10-05T12:00:00.000Z'),
                          problem: null,
                        }
                      : null,
                  },
                ],
        }),
      ),
    } satisfies ConfigurationReaderPort,
  );

const query = () => new ConfigurationQuery('acme', 'user_1');

describe('ConfigurationHandler', () => {
  it('says which integrations the team has', async () => {
    const read = await reading().execute(query());

    expect(read?.integrations.map((each) => each.integration)).toEqual([
      'linear',
    ]);
  });

  it('says how many tools the API spec it names lists, and when it was read', async () => {
    const read = await reading({ spec: true }).execute(query());

    expect(read?.integrations[0]?.spec).toEqual({
      kind: 'openapi',
      tools: 19,
      readAt: '2026-10-05T12:00:00.000Z',
      problem: null,
    });
    expect(
      (await reading().execute(query()))?.integrations[0]?.spec,
    ).toBeNull();
  });

  it('says which resource defines each integration', async () => {
    const read = await reading().execute(query());

    expect(read?.integrations[0]?.path).toBe('integrations/linear');
  });

  it('says an integration is disconnected where it requires a connection and the team has not authorized it', async () => {
    const read = await reading({ requiresConnection: true }).execute(query());

    expect(read?.integrations[0]).toMatchObject({
      connectionStatus: 'disconnected',
      linkedAccount: null,
    });
  });

  it('says an integration is connected, and the account name of the team, once the team has authorized it', async () => {
    const read = await reading({
      requiresConnection: true,
      linkedAccount: 'Acme',
    }).execute(query());

    expect(read?.integrations[0]).toMatchObject({
      connectionStatus: 'connected',
      linkedAccount: 'Acme',
    });
  });

  it('says an integration needs no connection where it requires none', async () => {
    const read = await reading().execute(query());

    expect(read?.integrations[0]?.connectionStatus).toBe('not-required');
  });

  it('lists nothing where the team has no integrations', async () => {
    const read = await reading({ defined: false }).execute(query());

    expect(read).toEqual({ integrations: [] });
  });

  it('answers with nothing where the team is not the caller’s', async () => {
    expect(await reading({ workspace: null }).execute(query())).toBeNull();
  });
});
