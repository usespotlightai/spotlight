import type { SecretRecord } from '@secrets/application/ports/secret-resources.port';
import { ReadSecretHandler } from '@secrets/application/queries/handlers/read-secret.handler';
import { ReadSecretQuery } from '@secrets/application/queries/read-secret.query';
import { SecretRunReach } from '@secrets/application/services/secret-run-reach.service';
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

const warningsWhen = async (used: boolean) => {
  const read = await new ReadSecretHandler(
    accessFor(() => true),
    {
      withId: async (id) => (id === HTTPBIN.id ? HTTPBIN : null),
      named: async () => null,
      namedIn: async () => [],
      secretsIn: async () => [],
    },
    new SecretRunReach(
      {
        register: () => undefined,
        of: async () =>
          used
            ? [{ kind: 'harness-profile', key: 'core/default', exposes: false }]
            : [],
      },
      { register: () => undefined, names: () => [] },
    ),
  ).execute(new ReadSecretQuery(HTTPBIN.id, ADMIN.principal));

  return read?.warnings.map((each) => ({
    at: each.field.rendered,
    reason: each.reason,
    warning: each.isWarning,
  }));
};

describe('ReadSecretHandler', () => {
  it('warns at the bindings that no run receives a secret that no harness profile or integration uses', async () => {
    expect(await warningsWhen(false)).toEqual([
      {
        at: 'bindings',
        reason:
          'no harness profile or integration uses this secret, so no run receives it. Name it in a harness profile or an integration',
        warning: true,
      },
    ]);
  });

  it('warns of nothing while a harness profile uses it', async () => {
    expect(await warningsWhen(true)).toEqual([]);
  });
});
