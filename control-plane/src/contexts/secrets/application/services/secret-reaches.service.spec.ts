import type { SecretRecord } from '@secrets/application/ports/secret-resources.port';
import type { NamedSecret } from '@secrets/application/ports/secret-uses.port';
import { SecretReaches } from '@secrets/application/services/secret-reaches.service';
import { NOW, WORKSPACE } from '@secrets/testing/secrets.fakes.fake-spec';
import { describe, expect, it } from 'vitest';

const record = (
  name: string,
  over: Partial<SecretRecord> = {},
): SecretRecord => ({
  id: `secret_${name}`,
  version: 1,
  workspaceId: WORKSPACE,
  name,
  bindings: [],
  sandbox: 'stand-in',
  valueVersion: null,
  holdsValue: true,
  rotatedAt: NOW,
  ...over,
});

const BOUND = [
  {
    host: 'httpbin.org',
    location: 'header',
    name: 'authorization',
    prefix: 'Bearer ',
  },
];

const reachesWith = (egressRunners: boolean) => {
  const asked: NamedSecret[] = [];
  const askedEgress: string[] = [];
  const reaches = new SecretReaches(
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
    {
      register: () => undefined,
      anyIn: async (workspaceId) => {
        askedEgress.push(workspaceId);
        return egressRunners;
      },
    },
  );

  return { reaches, asked, askedEgress };
};

const answers = (
  reached: readonly {
    record: SecretRecord;
    reach: { usedByRuns: boolean; deliverable: boolean };
  }[],
) =>
  reached.map(({ record: { name }, reach: { usedByRuns, deliverable } }) => ({
    name,
    usedByRuns,
    deliverable,
  }));

describe('SecretReaches', () => {
  it('says which secrets no harness profile or integration uses and that are no harness key', async () => {
    const { reaches, asked } = reachesWith(true);

    expect(
      answers(
        await reaches.ofEach([
          record('LINEAR_API_KEY'),
          record('HTTPBIN_TEST_TOKEN'),
          record('ANTHROPIC_API_KEY'),
        ]),
      ),
    ).toEqual([
      { name: 'LINEAR_API_KEY', usedByRuns: true, deliverable: true },
      { name: 'HTTPBIN_TEST_TOKEN', usedByRuns: false, deliverable: true },
      { name: 'ANTHROPIC_API_KEY', usedByRuns: true, deliverable: true },
    ]);
    expect(asked).toContainEqual({
      workspaceId: WORKSPACE.value,
      name: 'HTTPBIN_TEST_TOKEN',
    });
  });

  it('says a bound secret is undeliverable while no runner of its workspace has egress, and asks about the workspace once', async () => {
    const { reaches, askedEgress } = reachesWith(false);

    expect(
      answers(
        await reaches.ofEach([
          record('LINEAR_API_KEY', { bindings: BOUND }),
          record('HTTPBIN_TEST_TOKEN', { bindings: BOUND }),
          record('DEV_GITHUB_APP_KEY', { sandbox: 'env' }),
        ]),
      ),
    ).toEqual([
      { name: 'LINEAR_API_KEY', usedByRuns: true, deliverable: false },
      { name: 'HTTPBIN_TEST_TOKEN', usedByRuns: false, deliverable: false },
      { name: 'DEV_GITHUB_APP_KEY', usedByRuns: false, deliverable: true },
    ]);
    expect(askedEgress).toEqual([WORKSPACE.value]);
  });

  it('answers for one secret', async () => {
    const reach = await reachesWith(false).reaches.of(
      record('HTTPBIN_TEST_TOKEN', { bindings: BOUND }),
    );

    expect([reach.usedByRuns, reach.deliverable]).toEqual([false, false]);
  });
});
