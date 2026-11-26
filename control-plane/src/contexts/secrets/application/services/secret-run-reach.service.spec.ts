import type { SecretRecord } from '@secrets/application/ports/secret-resources.port';
import type { NamedSecret } from '@secrets/application/ports/secret-uses.port';
import { SecretRunReach } from '@secrets/application/services/secret-run-reach.service';
import { NOW, WORKSPACE } from '@secrets/testing/secrets.fakes.fake-spec';
import { describe, expect, it } from 'vitest';

const record = (name: string): SecretRecord => ({
  id: `secret_${name}`,
  version: 1,
  workspaceId: WORKSPACE,
  name,
  bindings: [],
  sandbox: 'stand-in',
  valueVersion: null,
  holdsValue: true,
  rotatedAt: NOW,
});

describe('SecretRunReach', () => {
  it('names the secrets that no harness profile or integration uses and that are no harness key', async () => {
    const asked: NamedSecret[] = [];
    const reach = new SecretRunReach(
      {
        register: () => undefined,
        of: async (secret) => {
          asked.push(secret);
          return secret.name === 'LINEAR_API_KEY'
            ? [{ kind: 'integration', key: 'core/linear', exposes: false }]
            : [];
        },
      },
      { register: () => undefined, names: () => ['ANTHROPIC_API_KEY'] },
    );

    expect([
      ...(await reach.unreached([
        record('LINEAR_API_KEY'),
        record('HTTPBIN_TEST_TOKEN'),
        record('ANTHROPIC_API_KEY'),
      ])),
    ]).toEqual(['HTTPBIN_TEST_TOKEN']);
    expect(asked).toContainEqual({
      workspaceId: WORKSPACE.value,
      name: 'HTTPBIN_TEST_TOKEN',
    });
  });
});
