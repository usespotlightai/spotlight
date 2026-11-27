import type { SecretRecord } from '@secrets/application/ports/secret-resources.port';
import { ListWorkspaceSecretsHandler } from '@secrets/application/queries/handlers/list-workspace-secrets.handler';
import { ListWorkspaceSecretsQuery } from '@secrets/application/queries/list-workspace-secrets.query';
import {
  ADMIN,
  accessFor,
  NOW,
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

const listedBy = (managesSecrets: boolean, slug = SLUG) =>
  new ListWorkspaceSecretsHandler(
    accessFor(() => managesSecrets),
    {
      withId: () => Promise.resolve(null),
      named: () => Promise.resolve(null),
      namedIn: () => Promise.resolve([]),
      secretsIn: () => Promise.resolve(RECORDS),
    },
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
      },
      {
        name: 'STAGING_PASSWORD',
        hosts: ['example.com'],
        sandbox: 'stand-in',
        valueOrigin: 'awaiting',
        valueSetAt: null,
        settable: true,
      },
      {
        name: 'VIEWER_TOKEN',
        hosts: ['example.com'],
        sandbox: 'stand-in',
        valueOrigin: 'spotlight',
        valueSetAt: NOW,
        settable: true,
      },
    ]);
  });

  it('lets only someone who manages secrets set a value', async () => {
    expect((await listedBy(false))?.some((each) => each.settable)).toBe(false);
  });

  it('finds no workspace for a stranger', async () => {
    expect(await listedBy(true, 'other')).toBeNull();
  });
});
