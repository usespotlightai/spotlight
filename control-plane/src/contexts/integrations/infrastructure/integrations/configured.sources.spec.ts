import type {
  Applied,
  AppliedConfigurationPort,
} from '@configuration/application/ports/applied-configuration.port';
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

const holding = (files: ConfigurationFile[] | null) => {
  return {
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

  it('builds one that verifies nothing, since no secret is held', async () => {
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
