import type { SecretRecord } from '@secrets/application/ports/secret-resources.port';
import { ReadSecretHandler } from '@secrets/application/queries/handlers/read-secret.handler';
import { ReadSecretQuery } from '@secrets/application/queries/read-secret.query';
import {
  ADMIN,
  accessFor,
  NOW,
  reachesFor,
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

const UNUSED = {
  at: 'bindings',
  reason:
    'no harness profile or integration uses this secret, so no run receives it. Name it in a harness profile or an integration',
  warning: true,
};

const UNDELIVERABLE = {
  at: 'bindings',
  reason:
    'are never injected: no runner pool of the workspace has egress. Add a pool that hosts pull from, or set provision.egress on a push pool',
  warning: true,
};

const warningsWhen = async ({
  egressRunners = true,
  used = true,
}: {
  egressRunners?: boolean;
  used?: boolean;
}) => {
  const read = await new ReadSecretHandler(
    accessFor(() => true),
    {
      withId: async (id) => (id === HTTPBIN.id ? HTTPBIN : null),
      named: async () => null,
      namedIn: async () => [],
      secretsIn: async () => [],
    },
    reachesFor({ used: () => used, egressRunners }),
  ).execute(new ReadSecretQuery(HTTPBIN.id, ADMIN.principal));

  return read?.warnings.map((each) => ({
    at: each.field.rendered,
    reason: each.reason,
    warning: each.isWarning,
  }));
};

describe('ReadSecretHandler', () => {
  it('warns at the bindings that egress never injects the secret while no runner pool of the workspace has egress', async () => {
    expect(await warningsWhen({ egressRunners: false })).toEqual([
      UNDELIVERABLE,
    ]);
  });

  it('warns at the bindings that no run receives a secret that no harness profile or integration uses', async () => {
    expect(await warningsWhen({ used: false })).toEqual([UNUSED]);
  });

  it('gives both warnings for a secret that nothing uses and no runner could deliver', async () => {
    expect(await warningsWhen({ used: false, egressRunners: false })).toEqual([
      UNUSED,
      UNDELIVERABLE,
    ]);
  });

  it('warns of nothing while a harness profile uses it and a runner of the workspace has egress', async () => {
    expect(await warningsWhen({})).toEqual([]);
  });
});
