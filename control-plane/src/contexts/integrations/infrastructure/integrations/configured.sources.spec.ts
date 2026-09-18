import type {
  Applied,
  AppliedConfigurationPort,
} from '@configuration/application/ports/applied-configuration.port';
import type { TeamSecretsPort } from '@configuration/application/ports/team-secrets.port';
import { ConfiguredSources } from '@integrations/infrastructure/integrations/configured.sources';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { HttpOutbound } from '@integrations/infrastructure/outbound/http-outbound';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const TEAM = {
  workspaceId: WORKSPACE,
  teamId: TeamId.of('team_1'),
  teamKey: 'platform',
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
  const resolveAll = vi.fn(
    async (_teamId: unknown, names: readonly { value: string }[]) =>
      Object.fromEntries(
        names.flatMap((name) => {
          const value = secrets[name.value];
          return value ? [[name.value, value]] : [];
        }),
      ),
  );

  return {
    resolveAll,
    sources: new ConfiguredSources(
      {
        of: vi.fn(async () =>
          files
            ? ({
                teamId: TeamId.of('team_1'),
                repository: Repository.of('acme/api'),
                files,
              } as Applied)
            : null,
        ),
        save: vi.fn(),
      } as unknown as AppliedConfigurationPort,
      { resolveAll } as unknown as TeamSecretsPort,
      new IntegrationReader(),
      { keys: async () => new Map() },
      new HttpOutbound([]),
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
    const { sources, resolveAll } = holding(
      [at('.spotlight/integrations/linear.yml', linear())],
      { LINEAR_WEBHOOK_SECRET: 'whsec_1' },
    );

    await sources.all(TEAM);

    expect(resolveAll).toHaveBeenCalledWith(TEAM.teamId, [
      expect.objectContaining({ value: 'LINEAR_WEBHOOK_SECRET' }),
    ]);
  });

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
