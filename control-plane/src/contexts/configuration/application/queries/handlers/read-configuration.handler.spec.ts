import type {
  ConfigurationReaderPort,
  ConfigurationView,
} from '@configuration/application/ports/configuration-reader.port';
import type { IntegrationLink } from '@configuration/application/ports/integration-links.port';
import type {
  TeamStanding,
  TeamsPort,
} from '@configuration/application/ports/teams.port';
import { ConfigurationHandler } from '@configuration/application/queries/handlers/read-configuration.handler';
import { ConfigurationQuery } from '@configuration/application/queries/read-configuration.query';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM: TeamStanding = {
  teamId: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  connected: false,
  viewer: UserId.of('user_1'),
  administers: true,
};

const asking = (
  over: {
    workspace?: null;
    applied?: boolean;
    linked?: readonly IntegrationLink[];
    connects?: boolean;
    kept?: string;
    moving?: string;
  } = {},
) =>
  new ConfigurationHandler(
    {
      find: vi.fn(),
      viewedBy: vi.fn(async () => (over.workspace === null ? null : TEAM)),
      inWorkspace: vi.fn(),
    } satisfies TeamsPort,
    {
      of: vi.fn(
        async (): Promise<ConfigurationView> => ({
          keptIn: over.kept ?? null,
          movingTo: over.moving ?? null,
          read:
            over.applied === false
              ? null
              : {
                  repository: 'acme/api',
                  sha: 'a1b2c3d',
                  integrations: [
                    {
                      source: 'linear',
                      name: 'Linear',
                      path: '.spotlight/integrations/linear.yml',
                      connectable: over.connects ?? false,
                    },
                  ],
                },
        }),
      ),
    } satisfies ConfigurationReaderPort,
    { heldBy: vi.fn(async () => over.linked ?? []) },
  );

const query = () => new ConfigurationQuery('acme', 'user_1');

describe('ConfigurationHandler', () => {
  it('says what the workspace listens to, and where it was read from', async () => {
    const read = await asking().execute(query());

    expect(read?.repository).toBe('acme/api');
    expect(read?.sha).toBe('a1b2c3d');
    expect(read?.integrations).toHaveLength(1);
  });

  describe('where the team reads from', () => {
    it('reads where the fallback rule last found it, where it keeps it nowhere', async () => {
      const read = await asking().execute(query());

      expect(read?.readsFrom).toBe('acme/api');
      expect(read?.movingTo).toBeNull();
    });

    it('says where it keeps it, and where it is moving to', async () => {
      const read = await asking({
        kept: 'acme/api',
        moving: 'acme/new',
      }).execute(query());

      expect(read?.readsFrom).toBe('acme/api');
      expect(read?.movingTo).toBe('acme/new');
    });

    it('says where it keeps it before anything has been read', async () => {
      const read = await asking({
        applied: false,
        kept: 'acme/pinned',
      }).execute(query());

      expect(read?.repository).toBeNull();
      expect(read?.readsFrom).toBe('acme/pinned');
    });
  });

  it('says which file each host is written in', async () => {
    const read = await asking().execute(query());

    expect(read?.integrations[0]?.path).toBe(
      '.spotlight/integrations/linear.yml',
    );
  });

  it('says a host is not connected where it links but the team has not', async () => {
    const read = await asking({ connects: true }).execute(query());

    expect(read?.integrations[0]?.connectable).toBe(true);
    expect(read?.integrations[0]?.connection).toBeNull();
  });

  it('shows the identity the host gave once a team has linked', async () => {
    const read = await asking({
      connects: true,
      linked: [{ source: 'linear', handle: 'Acme' }],
    }).execute(query());

    expect(read?.integrations[0]?.connection).toEqual({ handle: 'Acme' });
  });

  it('never offers to connect a host that does not link that way', async () => {
    const read = await asking().execute(query());

    expect(read?.integrations[0]?.connectable).toBe(false);
  });

  it('says nothing has been read yet where nothing has', async () => {
    const read = await asking({ applied: false }).execute(query());

    expect(read).toEqual({
      repository: null,
      readsFrom: null,
      movingTo: null,
      sha: null,
      integrations: [],
    });
  });

  it('answers with nothing where the team is not the caller’s', async () => {
    expect(await asking({ workspace: null }).execute(query())).toBeNull();
  });
});
