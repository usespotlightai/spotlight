import type { IntegrationReaderPort } from '@application/ports/integration-reader.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import { ConfigurationHandler } from '@application/queries/handlers/read-configuration.handler';
import { ConfigurationQuery } from '@application/queries/read-configuration.query';
import { Team } from '@domain/aggregates/team.aggregate';
import { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import { Integration } from '@domain/entities/integration.entity';
import type {
  HostConnectionRepository,
  HostConnectionSummary,
} from '@domain/repositories/host-connection.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { Commit } from '@domain/value-objects/commit.vo';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { SecretName } from '@domain/value-objects/secret-name.vo';
import { SourceKey } from '@domain/value-objects/source-key.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamKey } from '@domain/value-objects/team-key.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import { TeamRole } from '@domain/value-objects/team-role.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const READ_AT = new Date('2026-09-03T08:00:00.000Z');

const integration = (connects = false) =>
  Integration.of({
    source: SourceKey.of('linear'),
    name: 'Linear',
    connects,
    credentials: [SecretName.of('LINEAR_WEBHOOK_SECRET')],
    declares: [],
  });

const asking = (
  over: {
    workspace?: null;
    applied?: boolean;
    linked?: readonly HostConnectionSummary[];
    connects?: boolean;
    kept?: string;
    moving?: string;
  } = {},
) =>
  new ConfigurationHandler(
    {
      findTeamForMember: vi.fn(async () =>
        over.workspace === undefined
          ? {
              workspaceId: 'ws_1',
              teamId: 'team_1',
              teamKey: 'platform',
              slug: 'acme',
            }
          : over.workspace,
      ),
      findForMember: vi.fn(),
      identify: vi.fn(),
      identifyTeam: vi.fn(),
      listForMember: vi.fn(),
    } as unknown as WorkspaceReaderPort,
    {
      find: vi.fn(async () =>
        Team.rehydrate({
          id: TeamId.of('team_1'),
          workspaceId: WorkspaceId.of('ws_1'),
          key: TeamKey.of('platform'),
          name: TeamName.of('Platform'),
          members: [{ userId: UserId.of('user_1'), role: TeamRole.owner }],
          configRepository: over.kept ? Repository.of(over.kept) : null,
          movingConfigurationTo: over.moving
            ? Repository.of(over.moving)
            : null,
        }),
      ),
    } as unknown as TeamRepository,
    {
      findFor: vi.fn(async () =>
        over.applied === false
          ? null
          : TeamConfiguration.read({
              teamId: TeamId.of('team_1'),
              repository: Repository.of('acme/api'),
              commit: Commit.of('a1b2c3d'),
              files: [
                ConfigurationFile.of(
                  '.spotlight/integrations/linear.yml',
                  'version: 1',
                ),
              ],
              readAt: READ_AT,
            }),
      ),
      save: vi.fn(),
    } as unknown as TeamConfigurationRepository,
    {
      read: () => ({
        integrations: [integration(over.connects)],
        problems: [],
      }),
    } as unknown as IntegrationReaderPort,
    {
      held: vi.fn(async () => over.linked ?? []),
    } as unknown as HostConnectionRepository,
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
      linked: [{ source: 'linear', handle: 'Acme', connectedAt: READ_AT }],
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
