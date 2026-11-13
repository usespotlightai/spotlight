import type {
  HostCredentials,
  RunnerAuthenticatorPort,
} from '@runners/application/ports/runner-authenticator.port';
import type { HarnessLaunchPort } from '@runs/application/ports/harness-launch.port';
import { HarnessKeysHandler } from '@runs/application/queries/handlers/harness-keys.handler';
import { HarnessKeysQuery } from '@runs/application/queries/host.queries';
import { HeldHarnessKeys } from '@runs/application/services/held-harness-keys.service';
import type { HostSecretFetch } from '@secrets/application/ports/host-secret-fetches.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const authenticator: RunnerAuthenticatorPort = {
  authenticate: async (credential: HostCredentials) =>
    credential.bearer === 'pool-token'
      ? {
          source: { kind: 'pool', id: 'pool_1' },
          workspaceId: WorkspaceId.of('ws_1'),
        }
      : null,
};

const launch = {
  catalogue: () => [
    { id: 'claude-code', harnessKeys: ['ANTHROPIC_API_KEY'] },
    { id: 'codex', harnessKeys: ['CODEX_API_KEY', 'OPENAI_API_KEY'] },
  ],
} as unknown as HarnessLaunchPort;

const POOL = { bearer: 'pool-token', trust: undefined };

const handler = () => {
  const sealedForHost = vi.fn(async (request: HostSecretFetch) => ({
    secrets: request.secrets
      .filter((each) => each !== 'OPENAI_API_KEY')
      .map((each) => ({
        secret: each,
        host:
          each === 'ANTHROPIC_API_KEY' ? 'api.anthropic.com' : 'api.openai.com',
        location: 'header',
        name: 'authorization',
        prefix: 'Bearer ',
        sealed: `sealed(${each})`,
        externalRef: null,
      })),
    denied: request.secrets
      .filter((each) => each === 'OPENAI_API_KEY')
      .map((secret) => ({ secret, reason: 'not bound to any host' })),
  }));

  return {
    sealedForHost,
    subject: new HarnessKeysHandler(
      authenticator,
      new HeldHarnessKeys(launch, {
        namesIn: async () => [
          'ANTHROPIC_API_KEY',
          'LINEAR_API_KEY',
          'OPENAI_API_KEY',
        ],
      }),
      { sealedForHost },
    ),
  };
};

describe('fetching the harness keys for a host’s image probe', () => {
  it('seals each harness key its workspace holds, and no other secret, to the recipient', async () => {
    const { subject, sealedForHost } = handler();

    expect(
      await subject.execute(new HarnessKeysQuery(POOL, 'recipient-key')),
    ).toEqual({
      outcome: 'fetched',
      bound: ['api.anthropic.com'],
      secrets: [expect.objectContaining({ secret: 'ANTHROPIC_API_KEY' })],
      denied: [{ secret: 'OPENAI_API_KEY', reason: 'not bound to any host' }],
    });
    expect(sealedForHost).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      secrets: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY'],
      recipient: 'recipient-key',
    });
  });

  it('seals nothing for a host that no pool or trust accepts', async () => {
    const { subject, sealedForHost } = handler();

    expect(
      await subject.execute(
        new HarnessKeysQuery(
          { bearer: 'stolen', trust: undefined },
          'recipient-key',
        ),
      ),
    ).toEqual({ outcome: 'unauthorized' });
    expect(sealedForHost).not.toHaveBeenCalled();
  });
});
