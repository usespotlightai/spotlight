import type { TeamSecretsPort } from '@application/ports/team-secrets.port';
import { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { Commit } from '@domain/value-objects/commit.vo';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamKey } from '@domain/value-objects/team-key.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { ConfiguredSources } from '@infrastructure/integrations/configured.sources';
import { IntegrationReader } from '@infrastructure/integrations/integration.reader';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const TEAM = {
  workspaceId: WORKSPACE,
  teamId: TeamId.of('team_1'),
  teamKey: TeamKey.of('platform'),
};

const linear = (source = 'linear') => `
version: 1
integration: ${source}
webhook:
  verify:
    hmac:
      algorithm: sha256
      secret: secret.${source.toUpperCase()}_WEBHOOK_SECRET
      header: ${source}-signature
  events:
    - when: \${{ body.type == "Issue" }}
      raise:
        happening: ${source}.issue.completed
        label: Issue completed
        told: Done.
        marks:
          - kind: ${source}.issue
            value: \${{ body.data.identifier }}
`;

const holding = (
  files: ConfigurationFile[] | null,
  secrets: Record<string, string> = {},
) => {
  const resolve = vi.fn(
    async (_workspaceId: unknown, name: { value: string }) =>
      secrets[name.value] ?? null,
  );

  return {
    resolve,
    sources: new ConfiguredSources(
      {
        findFor: vi.fn(async () =>
          files
            ? TeamConfiguration.read({
                teamId: TeamId.of('team_1'),
                repository: Repository.of('acme/api'),
                commit: Commit.of('abc1234'),
                files,
                readAt: new Date(),
              })
            : null,
        ),
        save: vi.fn(),
      } as unknown as TeamConfigurationRepository,
      { resolve } as unknown as TeamSecretsPort,
      new IntegrationReader(),
      { keys: async () => new Map() },
    ),
  };
};

const at = (path: string, text: string) => ConfigurationFile.of(path, text);

describe('ConfiguredSources', () => {
  it('builds a source for every host the workspace declared', async () => {
    const { sources } = holding([
      at('.spotlight/integrations/linear.yml', linear()),
    ]);

    expect((await sources.all(TEAM)).map((each) => each.key)).toEqual([
      'linear',
    ]);
  });

  it('finds one by the name the world addresses it with', async () => {
    const { sources } = holding([
      at('.spotlight/integrations/linear.yml', linear()),
    ]);

    expect((await sources.find(TEAM, 'linear'))?.key).toBe('linear');
    expect(await sources.find(TEAM, 'sentry')).toBeNull();
  });

  it('hands each one the secret the file names', async () => {
    const { sources, resolve } = holding(
      [at('.spotlight/integrations/linear.yml', linear())],
      { LINEAR_WEBHOOK_SECRET: 'whsec_1' },
    );

    await sources.all(TEAM);

    expect(resolve).toHaveBeenCalledWith(
      TEAM.teamId,
      expect.objectContaining({ value: 'LINEAR_WEBHOOK_SECRET' }),
    );
  });

  // An integration half configured takes nobody's word for what happened.
  it('builds one that verifies nothing where no secret is set', async () => {
    const { sources } = holding([
      at('.spotlight/integrations/linear.yml', linear()),
    ]);

    const [source] = await sources.all(TEAM);

    expect(
      await source?.verifies({
        headers: { 'linear-signature': 'anything' },
        body: {},
        raw: Buffer.from('{}'),
      }),
    ).toBe(false);
  });

  it('has no sources at all before anything has been read', async () => {
    const { sources } = holding(null);

    expect(await sources.all(TEAM)).toEqual([]);
    expect(await sources.find(TEAM, 'linear')).toBeNull();
  });

  // A file that will not compile is not a source; its problems were written
  // down when it was read, and are what the workspace is shown instead.
  it('builds nothing from a file that will not read', async () => {
    const { sources } = holding([
      at('.spotlight/integrations/broken.yml', 'version: 2'),
      at('.spotlight/integrations/linear.yml', linear()),
    ]);

    expect((await sources.all(TEAM)).map((each) => each.key)).toEqual([
      'linear',
    ]);
  });

  it('builds one source where two files claim one host', async () => {
    const { sources } = holding([
      at('.spotlight/integrations/a.yml', linear()),
      at('.spotlight/integrations/z.yml', linear()),
    ]);

    expect(await sources.all(TEAM)).toHaveLength(1);
  });
});
