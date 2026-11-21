import type { SecretRecord } from '@secrets/application/ports/secret-resources.port';
import { BoundSecrets } from '@secrets/application/services/bound-secrets.service';
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
  holdsValue: false,
  rotatedAt: NOW,
  ...over,
});

const RECORDS = [
  record('STAGING_LOGIN_PASSWORD', {
    bindings: [
      {
        host: 'staging.example.com',
        location: 'header',
        name: 'authorization',
        prefix: 'Bearer ',
      },
      {
        host: 'staging.example.com',
        location: 'query',
        name: 'token',
        prefix: '',
      },
    ],
  }),
  record('LINEAR_API_KEY', {
    bindings: [
      {
        host: 'api.linear.app',
        location: 'header',
        name: 'authorization',
        prefix: 'Bearer ',
      },
    ],
    valueVersion: 1,
    holdsValue: true,
  }),
  record('VIEWER_TOKEN', { holdsValue: true }),
];

const bound = new BoundSecrets({
  withId: async () => null,
  named: async (workspaceId, name) =>
    RECORDS.find(
      (each) => each.workspaceId.equals(workspaceId) && each.name === name,
    ) ?? null,
  namedIn: async (workspaceId, names) =>
    RECORDS.filter(
      (each) =>
        each.workspaceId.equals(workspaceId) && names.includes(each.name),
    ),
  secretsIn: async () => RECORDS,
});

describe('BoundSecrets', () => {
  it('says, for each secret a run needs, what to send where and whether it awaits a value', async () => {
    expect(
      await bound.boundIn(WORKSPACE.value, [
        'LINEAR_API_KEY',
        'STAGING_LOGIN_PASSWORD',
        'VIEWER_TOKEN',
      ]),
    ).toEqual([
      {
        name: 'STAGING_LOGIN_PASSWORD',
        bindings: [
          {
            host: 'staging.example.com',
            location: 'header',
            name: 'authorization',
            sent: 'Bearer spotlight-egress:STAGING_LOGIN_PASSWORD',
          },
          {
            host: 'staging.example.com',
            location: 'query',
            name: 'token',
            sent: 'spotlight-egress:STAGING_LOGIN_PASSWORD',
          },
        ],
        awaitingValue: true,
        entersSandbox: false,
      },
      {
        name: 'LINEAR_API_KEY',
        bindings: [
          {
            host: 'api.linear.app',
            location: 'header',
            name: 'authorization',
            sent: 'Bearer spotlight-egress:LINEAR_API_KEY',
          },
        ],
        awaitingValue: false,
        entersSandbox: false,
      },
      {
        name: 'VIEWER_TOKEN',
        bindings: [],
        awaitingValue: false,
        entersSandbox: false,
      },
    ]);
  });

  it('says nothing of a secret that the workspace does not define', async () => {
    expect(await bound.boundIn(WORKSPACE.value, ['UNKNOWN_TOKEN'])).toEqual([]);
  });

  it('says nothing when a run needs no secret', async () => {
    expect(await bound.boundIn(WORKSPACE.value, [])).toEqual([]);
  });
});
