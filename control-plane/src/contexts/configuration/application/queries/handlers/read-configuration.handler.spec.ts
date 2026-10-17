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
    applied?: boolean;
    handle?: string | null;
    connects?: boolean;
    described?: boolean;
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
            over.applied === false
              ? []
              : [
                  {
                    source: 'linear',
                    name: 'Linear',
                    path: 'integrations/linear',
                    connectable: over.connects ?? false,
                    holderRule: 'team',
                    linked: over.handle !== undefined,
                    handle: over.handle ?? null,
                    described: over.described
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
  it('says what the team listens to', async () => {
    const read = await reading().execute(query());

    expect(read?.integrations.map((each) => each.source)).toEqual(['linear']);
  });

  it('says how many tools the API description it names lists, and when it was read', async () => {
    const read = await reading({ described: true }).execute(query());

    expect(read?.integrations[0]?.described).toEqual({
      kind: 'openapi',
      tools: 19,
      readAt: '2026-10-05T12:00:00.000Z',
      problem: null,
    });
    expect(
      (await reading().execute(query()))?.integrations[0]?.described,
    ).toBeNull();
  });

  it('says which resource defines each host', async () => {
    const read = await reading().execute(query());

    expect(read?.integrations[0]?.path).toBe('integrations/linear');
  });

  it('says a host is unlinked where it links by authorizing but the team has not', async () => {
    const read = await reading({ connects: true }).execute(query());

    expect(read?.integrations[0]).toMatchObject({
      connectionStatus: 'unlinked',
      handle: null,
    });
  });

  it('says a host is linked, and what it calls the team, once the team has authorized it', async () => {
    const read = await reading({
      connects: true,
      handle: 'Acme',
    }).execute(query());

    expect(read?.integrations[0]).toMatchObject({
      connectionStatus: 'linked',
      handle: 'Acme',
    });
  });

  it('says a host that does not link that way only listens', async () => {
    const read = await reading().execute(query());

    expect(read?.integrations[0]?.connectionStatus).toBe('listens');
  });

  it('lists nothing where the team listens to nothing', async () => {
    const read = await reading({ applied: false }).execute(query());

    expect(read).toEqual({ integrations: [] });
  });

  it('answers with nothing where the team is not the caller’s', async () => {
    expect(await reading({ workspace: null }).execute(query())).toBeNull();
  });
});
