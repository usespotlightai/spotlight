import type {
  DefinedIntegration,
  DefinedIntegrationsPort,
} from '@integrations/application/ports/defined-integrations.port';
import { ConfiguredSources } from '@integrations/infrastructure/integrations/configured.sources';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { HttpOutbound } from '@integrations/infrastructure/outbound/http-outbound';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const expressions = new CelExpressionEngine();

const WORKSPACE = WorkspaceId.of('ws_1');

const TEAM = {
  workspaceId: WORKSPACE,
  teamId: TeamId.of('team_1'),
  teamKey: 'platform',
};

const linear = (source = 'linear') => `
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

const holding = (integrations: DefinedIntegration[]) => {
  return {
    sources: new ConfiguredSources(
      {
        ofTeam: vi.fn(async () => integrations),
        everywhere: vi.fn(),
      } satisfies DefinedIntegrationsPort,
      new IntegrationReader(expressions),
      { keys: async () => new Map() },
      new HttpOutbound([]),
    ),
  };
};

describe('ConfiguredSources', () => {
  it('builds a source for every host the workspace declared', async () => {
    const { sources } = holding([defined(linear())]);

    expect((await sources.all(TEAM)).map((each) => each.key)).toEqual([
      'linear',
    ]);
  });

  it('finds one by the name the world addresses it with', async () => {
    const { sources } = holding([defined(linear())]);

    expect((await sources.find(TEAM, 'linear'))?.key).toBe('linear');
    expect(await sources.find(TEAM, 'sentry')).toBeNull();
  });

  it('builds one that verifies nothing, since no secret is held', async () => {
    const { sources } = holding([defined(linear())]);

    const [source] = await sources.all(TEAM);

    expect(
      await source?.verifies({
        headers: { 'linear-signature': 'anything' },
        body: {},
        raw: Buffer.from('{}'),
      }),
    ).toBe(false);
  });

  it('has no sources at all before anything has been defined', async () => {
    const { sources } = holding([]);

    expect(await sources.all(TEAM)).toEqual([]);
    expect(await sources.find(TEAM, 'linear')).toBeNull();
  });

  it('builds nothing from a definition that will not read', async () => {
    const { sources } = holding([
      defined('integration: BROKEN'),
      defined(linear()),
    ]);

    expect((await sources.all(TEAM)).map((each) => each.key)).toEqual([
      'linear',
    ]);
  });
});
