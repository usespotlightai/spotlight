import type { SecretRecord } from '@secrets/application/ports/secret-resources.port';
import { SecretReadiness } from '@secrets/application/services/secret-readiness.service';
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
  valueVersion: null,
  holdsValue: false,
  rotatedAt: NOW,
  ...over,
});

const RECORDS = [
  record('STAGING_LOGIN_PASSWORD'),
  record('LINEAR_API_KEY', { valueVersion: 1, holdsValue: true }),
  record('VIEWER_TOKEN', { holdsValue: true }),
];

const readiness = new SecretReadiness({
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

describe('SecretReadiness', () => {
  it('names the secrets a run needs that have no value yet', async () => {
    expect(
      await readiness.awaitingValue(WORKSPACE.value, [
        'LINEAR_API_KEY',
        'STAGING_LOGIN_PASSWORD',
        'VIEWER_TOKEN',
      ]),
    ).toEqual(['STAGING_LOGIN_PASSWORD']);
  });

  it('names no secret that the workspace does not define', async () => {
    expect(
      await readiness.awaitingValue(WORKSPACE.value, ['UNKNOWN_TOKEN']),
    ).toEqual([]);
  });

  it('names nothing when a run needs no secret', async () => {
    expect(await readiness.awaitingValue(WORKSPACE.value, [])).toEqual([]);
  });
});
