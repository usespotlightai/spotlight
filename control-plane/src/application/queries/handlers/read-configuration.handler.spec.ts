import type { IntegrationReaderPort } from '@application/ports/integration-reader.port';
import type { TeamSecretsPort } from '@application/ports/team-secrets.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import { ConfigurationHandler } from '@application/queries/handlers/read-configuration.handler';
import { ConfigurationQuery } from '@application/queries/read-configuration.query';
import { Team } from '@domain/aggregates/team.aggregate';
import { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import { DeclaredHappening } from '@domain/entities/declared-happening.entity';
import { Integration } from '@domain/entities/integration.entity';
import type {
  HostConnectionRepository,
  HostConnectionSummary,
} from '@domain/repositories/host-connection.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { Commit } from '@domain/value-objects/commit.vo';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import { Happening } from '@domain/value-objects/happening.vo';
import { MarkKind } from '@domain/value-objects/mark-kind.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { SecretName } from '@domain/value-objects/secret-name.vo';
import { SourceKey } from '@domain/value-objects/source-key.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamKey } from '@domain/value-objects/team-key.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
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
    declares: [
      DeclaredHappening.of({
        happening: Happening.of('linear.issue.completed'),
        label: 'Issue completed',
        told: 'Done.',
        finds: [MarkKind.of('linear.issue')],
      }),
    ],
  });

const asking = (
  over: {
    workspace?: null;
    applied?: boolean;
    problems?: readonly ConfigurationProblem[];
    held?: readonly string[];
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
          members: [{ userId: UserId.of('user_1'), role: 'owner' }],
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
              problems: over.problems ?? [],
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
      held: vi.fn(async () =>
        (over.held ?? ['LINEAR_WEBHOOK_SECRET']).map((name) => ({
          name,
          setAt: READ_AT,
        })),
      ),
    } as unknown as TeamSecretsPort,
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
    expect(read?.readAt).toBe(READ_AT.toISOString());
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

  // What a person copies into the host, so it has to be there to copy.
  it('says where each host should send its deliveries', async () => {
    const read = await asking().execute(query());

    expect(read?.integrations[0]?.deliverTo).toBe(
      '/api/webhooks/w/acme/t/platform/linear',
    );
  });

  it('names every word the host can raise', async () => {
    const read = await asking().execute(query());

    expect(read?.integrations[0]?.happenings).toEqual([
      { happening: 'linear.issue.completed', label: 'Issue completed' },
    ]);
  });

  // Named rather than shown, and only whether there is one at all.
  it('names the secret without ever giving it back', async () => {
    const read = await asking().execute(query());

    expect(read?.integrations[0]?.secrets).toEqual([
      { name: 'LINEAR_WEBHOOK_SECRET', set: true },
    ]);
    expect(JSON.stringify(read)).not.toContain('whsec');
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

  it('says when a host is waiting on a secret nobody set', async () => {
    const read = await asking({ held: [] }).execute(query());

    expect(read?.integrations[0]?.secrets).toEqual([
      { name: 'LINEAR_WEBHOOK_SECRET', set: false },
    ]);
  });

  it('carries what is wrong with the files', async () => {
    const broken = ConfigurationProblem.of({
      path: 'x.yml',
      at: 'the file',
      reason: 'is not YAML',
    });
    const read = await asking({ problems: [broken] }).execute(query());

    expect(read?.problems).toEqual([
      { path: broken.path, at: broken.at, reason: broken.reason },
    ]);
  });

  it('says nothing has been read yet where nothing has', async () => {
    const read = await asking({ applied: false }).execute(query());

    expect(read).toEqual({
      repository: null,
      readsFrom: null,
      movingTo: null,
      sha: null,
      readAt: null,
      integrations: [],
      problems: [],
    });
  });

  // Someone outside it is not told a workspace is there at all.
  it('answers with nothing where the team is not the caller’s', async () => {
    expect(await asking({ workspace: null }).execute(query())).toBeNull();
  });
});
