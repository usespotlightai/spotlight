import type { SecretRecord } from '@secrets/application/ports/secret-resources.port';
import { ListWorkspaceSecretsHandler } from '@secrets/application/queries/handlers/list-workspace-secrets.handler';
import { ListWorkspaceSecretsQuery } from '@secrets/application/queries/list-workspace-secrets.query';
import {
  ADMIN,
  accessFor,
  NOW,
  reachesFor,
  SLUG,
  WORKSPACE,
} from '@secrets/testing/secrets.fakes.fake-spec';
import { describe, expect, it } from 'vitest';

const record = (
  name: string,
  over: Partial<SecretRecord> = {},
): SecretRecord => ({
  id: `secret_${name}`,
  version: 1,
  workspaceId: WORKSPACE,
  name,
  bindings: [
    {
      host: 'example.com',
      location: 'header',
      name: 'authorization',
      prefix: '',
    },
  ],
  sandbox: 'stand-in',
  valueVersion: null,
  holdsValue: false,
  rotatedAt: NOW,
  ...over,
});

const RECORDS = [
  record('LINEAR_API_KEY', { valueVersion: 2, holdsValue: true }),
  record('STAGING_PASSWORD'),
  record('VIEWER_TOKEN', { holdsValue: true }),
];

const listedBy = (
  managesSecrets: boolean,
  slug = SLUG,
  {
    egressRunners = true,
    records = RECORDS,
    used = records.map((each) => each.name),
  }: {
    egressRunners?: boolean;
    records?: readonly SecretRecord[];
    used?: readonly string[];
  } = {},
) =>
  new ListWorkspaceSecretsHandler(
    accessFor(() => managesSecrets),
    {
      withId: async () => null,
      named: async () => null,
      namedIn: async () => [],
      secretsIn: async () => records,
    },
    reachesFor({ used: (name) => used.includes(name), egressRunners }),
  ).execute(new ListWorkspaceSecretsQuery(slug, ADMIN.principal));

describe('ListWorkspaceSecretsHandler', () => {
  it('says where each value comes from, by name, and never the value', async () => {
    expect(await listedBy(true)).toEqual([
      {
        name: 'LINEAR_API_KEY',
        hosts: ['example.com'],
        sandbox: 'stand-in',
        valueOrigin: 'terraform',
        valueSetAt: NOW,
        settable: false,
        reach: { usedByRuns: true, deliverable: true },
      },
      {
        name: 'STAGING_PASSWORD',
        hosts: ['example.com'],
        sandbox: 'stand-in',
        valueOrigin: 'awaiting',
        valueSetAt: null,
        settable: true,
        reach: { usedByRuns: true, deliverable: true },
      },
      {
        name: 'VIEWER_TOKEN',
        hosts: ['example.com'],
        sandbox: 'stand-in',
        valueOrigin: 'spotlight',
        valueSetAt: NOW,
        settable: true,
        reach: { usedByRuns: true, deliverable: true },
      },
    ]);
  });

  it('says a bound secret is undeliverable while no runner of the workspace has egress', async () => {
    const listed = await listedBy(true, SLUG, {
      egressRunners: false,
      records: [
        record('HTTPBIN_TEST_TOKEN'),
        record('DEV_GITHUB_APP_KEY', { bindings: [], sandbox: 'env' }),
      ],
    });

    expect(listed?.map(({ name, reach }) => ({ name, reach }))).toEqual([
      {
        name: 'HTTPBIN_TEST_TOKEN',
        reach: { usedByRuns: true, deliverable: false },
      },
      {
        name: 'DEV_GITHUB_APP_KEY',
        reach: { usedByRuns: true, deliverable: true },
      },
    ]);
  });

  it('says which secrets no run receives, since no harness profile or integration uses them', async () => {
    const listed = await listedBy(true, SLUG, { used: ['LINEAR_API_KEY'] });

    expect(listed?.map(({ name, reach }) => ({ name, reach }))).toEqual([
      {
        name: 'LINEAR_API_KEY',
        reach: { usedByRuns: true, deliverable: true },
      },
      {
        name: 'STAGING_PASSWORD',
        reach: { usedByRuns: false, deliverable: true },
      },
      { name: 'VIEWER_TOKEN', reach: { usedByRuns: false, deliverable: true } },
    ]);
  });

  it('says both for a bound secret that nothing uses while no runner has egress', async () => {
    const listed = await listedBy(true, SLUG, {
      egressRunners: false,
      records: [record('HTTPBIN_TEST_TOKEN')],
      used: [],
    });

    expect(listed?.map(({ reach }) => reach)).toEqual([
      { usedByRuns: false, deliverable: false },
    ]);
  });

  it('lets only someone who manages secrets set a value', async () => {
    expect((await listedBy(false))?.some((each) => each.settable)).toBe(false);
  });

  it('finds no workspace for a stranger', async () => {
    expect(await listedBy(true, 'other')).toBeNull();
  });
});
