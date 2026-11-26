import type { SecretRecord } from '@secrets/application/ports/secret-resources.port';
import { ReadSecretHandler } from '@secrets/application/queries/handlers/read-secret.handler';
import { ReadSecretQuery } from '@secrets/application/queries/read-secret.query';
import {
  ADMIN,
  accessFor,
  NOW,
  WORKSPACE,
} from '@secrets/testing/secrets.fakes.fake-spec';
import { describe, expect, it } from 'vitest';

const HTTPBIN: SecretRecord = {
  id: 'secret_httpbin',
  version: 1,
  workspaceId: WORKSPACE,
  name: 'HTTPBIN_TEST_TOKEN',
  bindings: [
    {
      host: 'httpbin.org',
      location: 'header',
      name: 'authorization',
      prefix: 'Bearer ',
    },
  ],
  sandbox: 'stand-in',
  valueVersion: 1,
  holdsValue: true,
  rotatedAt: NOW,
};

const warningsWhen = async (egressRunners: boolean) => {
  const read = await new ReadSecretHandler(
    accessFor(() => true),
    {
      withId: async (id) => (id === HTTPBIN.id ? HTTPBIN : null),
      named: async () => null,
      namedIn: async () => [],
      secretsIn: async () => [],
    },
    { register: () => undefined, anyIn: async () => egressRunners },
  ).execute(new ReadSecretQuery(HTTPBIN.id, ADMIN.principal));

  return read?.warnings.map((each) => ({
    at: each.field.rendered,
    reason: each.reason,
    warning: each.isWarning,
  }));
};

describe('ReadSecretHandler', () => {
  it('warns at the bindings that egress never injects the secret while no runner pool of the workspace has egress', async () => {
    expect(await warningsWhen(false)).toEqual([
      {
        at: 'bindings',
        reason:
          'are never injected: no runner pool of the workspace has egress. Add a pool that hosts pull from, or set provision.egress on a push pool',
        warning: true,
      },
    ]);
  });

  it('warns of nothing while a runner of the workspace has egress', async () => {
    expect(await warningsWhen(true)).toEqual([]);
  });
});
