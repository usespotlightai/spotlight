import { SandboxEnvReveals } from '@secrets/application/services/sandbox-env-reveals.service';
import {
  InMemorySecrets,
  InMemoryStore,
  RecordingLogger,
  saveSecret,
  WORKSPACE,
} from '@secrets/testing/secrets.fakes.fake-spec';
import { describe, expect, it } from 'vitest';

const setUp = async () => {
  const store = new InMemoryStore();
  const secrets = new InMemorySecrets(store);
  const logger = new RecordingLogger();

  await saveSecret(secrets, 'secret_key', {
    name: 'DEV_GITHUB_APP_KEY',
    value: '-----BEGIN KEY-----\nabc\n-----END KEY-----',
    bindings: [],
    sandbox: 'env',
  });
  await saveSecret(secrets, 'secret_linear', { name: 'LINEAR_API_KEY' });
  await saveSecret(secrets, 'secret_pin', {
    name: 'DEV_PIN',
    value: '1234',
    bindings: [],
    sandbox: 'env',
  });
  await saveSecret(secrets, 'secret_waiting', {
    name: 'DEV_DATABASE_URL',
    value: null,
    valueVersion: null,
    bindings: [],
    sandbox: 'env',
  });

  return { reveals: new SandboxEnvReveals(secrets, store, logger), logger };
};

const revealing = (variables: { variable: string; secret: string }[]) => ({
  workspaceId: WORKSPACE.value,
  runId: 'run_1',
  variables,
});

describe('SandboxEnvReveals', () => {
  it('gives each variable the value of a secret that allows the sandbox, and logs which secrets it gave', async () => {
    const { reveals, logger } = await setUp();

    const revealed = await reveals.revealFor(
      revealing([
        { variable: 'GITHUB_APP_PRIVATE_KEY', secret: 'DEV_GITHUB_APP_KEY' },
      ]),
    );

    expect(
      revealed.variables.map((each) => [each.name, each.value.revealed()]),
    ).toEqual([
      ['GITHUB_APP_PRIVATE_KEY', '-----BEGIN KEY-----\nabc\n-----END KEY-----'],
    ]);
    expect(revealed.denied).toEqual([]);
    expect(logger.informed).toEqual([
      {
        workspaceId: WORKSPACE.value,
        runId: 'run_1',
        secrets: ['DEV_GITHUB_APP_KEY'],
      },
    ]);
  });

  it('denies a value too short to replace with its stand-in', async () => {
    const { reveals, logger } = await setUp();

    const revealed = await reveals.revealFor(
      revealing([{ variable: 'PIN', secret: 'DEV_PIN' }]),
    );

    expect(revealed.variables).toEqual([]);
    expect(revealed.denied).toEqual([
      {
        secret: 'DEV_PIN',
        reason: expect.stringContaining(
          'is shorter than 8 characters',
        ) as unknown,
      },
    ]);
    expect(logger.informed).toEqual([]);
  });

  it('denies a secret kept out of sandboxes, one without a value and one the workspace does not have', async () => {
    const { reveals, logger } = await setUp();

    const revealed = await reveals.revealFor(
      revealing([
        { variable: 'LINEAR_API_KEY', secret: 'LINEAR_API_KEY' },
        { variable: 'DATABASE_URL', secret: 'DEV_DATABASE_URL' },
        { variable: 'GONE', secret: 'GONE' },
      ]),
    );

    expect(revealed.variables).toEqual([]);
    expect(revealed.denied.map((each) => each.secret)).toEqual([
      'LINEAR_API_KEY',
      'DEV_DATABASE_URL',
      'GONE',
    ]);
    expect(revealed.denied[0]?.reason).toMatch(
      /does not allow its value in a sandbox/,
    );
    expect(logger.informed).toEqual([]);
  });
});
