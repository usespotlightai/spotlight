import { createHmac } from 'node:crypto';
import type {
  DefinedIntegration,
  DefinedIntegrationsPort,
} from '@integrations/application/ports/defined-integrations.port';
import { ConfiguredWebhookProviders } from '@integrations/infrastructure/integrations/configured-webhook-providers';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { HttpOutbound } from '@integrations/infrastructure/outbound/http-outbound';
import { unlimited } from '@integrations/infrastructure/outbound/outbound-limits.fake-spec';
import { allowingOutbound } from '@integrations/infrastructure/outbound/outbound-policy.fake-spec';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { operationsContaining } from '@integrations/integrations.documents.fake-spec';
import { injecting } from '@integrations/integrations.secrets.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { unscoped } from '@platform/outbound/outbound-scope.fake-spec';
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

const linear = (integration = 'linear') => `
integration: ${integration}
webhook:
  verify:
    hmac:
      algorithm: sha256
      secret: secret.${integration.toUpperCase()}_WEBHOOK_SECRET
      header: ${integration}-signature
  events:
    - when: \${{ body.type == "Issue" }}
      raise:
        happening: ${integration}.issue.completed
        label: Issue completed
        summary: Done.
        marks:
          - kind: ${integration}.issue
            value: \${{ body.data.identifier }}
`;

const configured = (
  integrations: DefinedIntegration[],
  secrets: Readonly<Record<string, string>> = {},
) => {
  const { injection, forVerifying } = injecting(
    Object.fromEntries(
      Object.entries(secrets).map(([name, value]) => [
        name,
        { host: 'api.linear.app', value },
      ]),
    ),
  );

  return {
    forVerifying,
    providers: new ConfiguredWebhookProviders(
      {
        ofTeam: vi.fn(async () => integrations),
        everywhere: vi.fn(),
      } satisfies DefinedIntegrationsPort,
      new IntegrationReader(expressions, operationsContaining()),
      { keys: async () => new Map() },
      new HttpOutbound(allowingOutbound([])),
      injection,
      unlimited,
      unscoped,
    ),
  };
};

describe('ConfiguredWebhookProviders', () => {
  it('builds a provider for every integration the workspace declared', async () => {
    const { providers } = configured([defined(linear())]);

    expect((await providers.all(TEAM)).map((each) => each.key)).toEqual([
      'linear',
    ]);
  });

  it('finds one by the name of the integration', async () => {
    const { providers } = configured([defined(linear())]);

    expect((await providers.find(TEAM, 'linear'))?.key).toBe('linear');
    expect(await providers.find(TEAM, 'sentry')).toBeNull();
  });

  it('verifies a delivery signed with the secret the workspace has', async () => {
    const { providers, forVerifying } = configured([defined(linear())], {
      LINEAR_WEBHOOK_SECRET: 'lin_wh_1',
    });
    const raw = Buffer.from('{"type":"Issue"}');

    const [provider] = await providers.all(TEAM);

    expect(
      await provider?.verifies({
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

  it('rejects a delivery signed with any other secret', async () => {
    const { providers } = configured([defined(linear())], {
      LINEAR_WEBHOOK_SECRET: 'lin_wh_1',
    });
    const raw = Buffer.from('{}');

    const [provider] = await providers.all(TEAM);

    expect(
      await provider?.verifies({
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

  it('fails to verify while the workspace has no such secret', async () => {
    const { providers } = configured([defined(linear())]);

    const [provider] = await providers.all(TEAM);

    await expect(
      provider?.verifies({
        headers: { 'linear-signature': 'anything' },
        body: {},
        raw: Buffer.from('{}'),
      }),
    ).rejects.toThrow(
      'Secret LINEAR_WEBHOOK_SECRET not found. Please create it first.',
    );
  });

  it('has no providers at all before anything has been defined', async () => {
    const { providers } = configured([]);

    expect(await providers.all(TEAM)).toEqual([]);
    expect(await providers.find(TEAM, 'linear')).toBeNull();
  });

  it('builds nothing from a definition that will not read', async () => {
    const { providers } = configured([
      defined('integration: BROKEN'),
      defined(linear()),
    ]);

    expect((await providers.all(TEAM)).map((each) => each.key)).toEqual([
      'linear',
    ]);
  });
});
