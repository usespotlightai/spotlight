import type { IntegrationReaderPort } from '@application/ports/integration-reader.port';
import type { TeamSecretsPort } from '@application/ports/team-secrets.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import { ConfigurationHandler } from '@application/queries/handlers/read-configuration.handler';
import { ConfigurationQuery } from '@application/queries/read-configuration.query';
import { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import { DeclaredHappening } from '@domain/entities/declared-happening.entity';
import { Integration } from '@domain/entities/integration.entity';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { Commit } from '@domain/value-objects/commit.vo';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import { Happening } from '@domain/value-objects/happening.vo';
import { MarkKind } from '@domain/value-objects/mark-kind.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { SecretName } from '@domain/value-objects/secret-name.vo';
import { Signing } from '@domain/value-objects/signing.vo';
import { SourceKey } from '@domain/value-objects/source-key.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { describe, expect, it, vi } from 'vitest';

const READ_AT = new Date('2026-09-03T08:00:00.000Z');

const integration = () =>
  Integration.of({
    source: SourceKey.of('linear'),
    name: 'Linear',
    signing: Signing.of({
      scheme: 'hmac-sha256',
      header: 'linear-signature',
      secret: SecretName.of('LINEAR_WEBHOOK_SECRET'),
    }),
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
      read: () => ({ integrations: [integration()], problems: [] }),
    } as unknown as IntegrationReaderPort,
    {
      held: vi.fn(async () =>
        (over.held ?? ['LINEAR_WEBHOOK_SECRET']).map((name) => ({
          name,
          setAt: READ_AT,
        })),
      ),
    } as unknown as TeamSecretsPort,
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

    expect(read?.integrations[0]?.secret).toBe('LINEAR_WEBHOOK_SECRET');
    expect(read?.integrations[0]?.secretSet).toBe(true);
    expect(JSON.stringify(read)).not.toContain('whsec');
  });

  it('says when a host is waiting on a secret nobody set', async () => {
    const read = await asking({ held: [] }).execute(query());

    expect(read?.integrations[0]?.secretSet).toBe(false);
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
