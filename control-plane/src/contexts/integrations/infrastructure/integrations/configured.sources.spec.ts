import { createHmac } from 'node:crypto';
import type {
  DefinedIntegration,
  DefinedIntegrationsPort,
} from '@integrations/application/ports/defined-integrations.port';
import { ConfiguredSources } from '@integrations/infrastructure/integrations/configured.sources';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { HttpOutbound } from '@integrations/infrastructure/outbound/http-outbound';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { operationsHolding } from '@integrations/integrations.documents.fake-spec';
import { injecting } from '@integrations/integrations.secrets.fake-spec';
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

const holding = (
  integrations: DefinedIntegration[],
  held: Readonly<Record<string, string>> = {},
) => {
  const { injection, forVerifying } = injecting(
    Object.fromEntries(
      Object.entries(held).map(([name, value]) => [
        name,
        { host: 'api.linear.app', value },
      ]),
    ),
  );

  return {
    forVerifying,
    sources: new ConfiguredSources(
      {
        ofTeam: vi.fn(async () => integrations),
        everywhere: vi.fn(),
      } satisfies DefinedIntegrationsPort,
      new IntegrationReader(expressions, operationsHolding()),
      { keys: async () => new Map() },
      new HttpOutbound([]),
      injection,
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

  it('verifies a delivery signed with the secret the workspace holds', async () => {
    const { sources, forVerifying } = holding([defined(linear())], {
      LINEAR_WEBHOOK_SECRET: 'lin_wh_1',
    });
    const raw = Buffer.from('{"type":"Issue"}');

    const [source] = await sources.all(TEAM);

    expect(
      await source?.verifies({
        headers: {
          'linear-signature': createHmac('sha256', 'lin_wh_1')
            .update(raw)
            .digest('hex'),
        },
        body: { type: 'Issue' },
        raw,
      }),
    ).toBe(true);
    expect(forVerifying).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      secret: 'LINEAR_WEBHOOK_SECRET',
    });
  });

  it('refuses a delivery signed with any other secret', async () => {
    const { sources } = holding([defined(linear())], {
      LINEAR_WEBHOOK_SECRET: 'lin_wh_1',
    });
    const raw = Buffer.from('{}');

    const [source] = await sources.all(TEAM);

    expect(
      await source?.verifies({
        headers: {
          'linear-signature': createHmac('sha256', 'guessed')
            .update(raw)
            .digest('hex'),
        },
        body: {},
        raw,
      }),
    ).toBe(false);
  });

  it('fails to verify while the workspace holds no such secret', async () => {
    const { sources } = holding([defined(linear())]);

    const [source] = await sources.all(TEAM);

    await expect(
      source?.verifies({
        headers: { 'linear-signature': 'anything' },
        body: {},
        raw: Buffer.from('{}'),
      }),
    ).rejects.toThrow(
      'Secret LINEAR_WEBHOOK_SECRET not found. Please define it first.',
    );
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
