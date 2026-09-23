import type {
  ConfigurationReaderPort,
  ConfigurationView,
} from '@configuration/application/ports/configuration-reader.port';
import type { IntegrationLink } from '@configuration/application/ports/integration-links.port';
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

const asking = (
  over: {
    workspace?: null;
    applied?: boolean;
    linked?: readonly IntegrationLink[];
    connects?: boolean;
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
                    path: '.spotlight/integrations/linear.yml',
                    connectable: over.connects ?? false,
                  },
                ],
        }),
      ),
    } satisfies ConfigurationReaderPort,
    {
      heldBy: vi.fn(async () => over.linked ?? []),
      linked: vi.fn(async () => {}),
    },
  );

const query = () => new ConfigurationQuery('acme', 'user_1');

describe('ConfigurationHandler', () => {
  it('says what the team listens to', async () => {
    const read = await asking().execute(query());

    expect(read?.integrations.map((each) => each.source)).toEqual(['linear']);
  });

  it('says which file each host is written in', async () => {
    const read = await asking().execute(query());

    expect(read?.integrations[0]?.path).toBe(
      '.spotlight/integrations/linear.yml',
    );
  });

  it('says a host is unlinked where it links by authorizing but the team has not', async () => {
    const read = await asking({ connects: true }).execute(query());

    expect(read?.integrations[0]).toMatchObject({
      standing: 'unlinked',
      handle: null,
    });
  });

  it('says a host is linked, and what it calls the team, once the team has authorized it', async () => {
    const read = await asking({
      connects: true,
      linked: [{ source: 'linear', handle: 'Acme' }],
    }).execute(query());

    expect(read?.integrations[0]).toMatchObject({
      standing: 'linked',
      handle: 'Acme',
    });
  });

  it('says a host that does not link that way only listens', async () => {
    const read = await asking().execute(query());

    expect(read?.integrations[0]?.standing).toBe('listens');
  });

  it('lists nothing where the team listens to nothing', async () => {
    const read = await asking({ applied: false }).execute(query());

    expect(read).toEqual({ integrations: [] });
  });

  it('answers with nothing where the team is not the caller’s', async () => {
    expect(await asking({ workspace: null }).execute(query())).toBeNull();
  });
});
