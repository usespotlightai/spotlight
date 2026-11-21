import { SandboxEnvReveals } from '@secrets/application/services/sandbox-env-reveals.service';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { SecretUses } from '@secrets/domain/value-objects/secret-uses.vo';
import {
  BY,
  definition,
  InMemorySecrets,
  NOW,
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
  });
  const pin = await secrets.withId(SecretId.of('secret_pin'));

  if (!pin) {
    throw new Error('DEV_PIN was not saved');
  }

  await secrets.save(
    pin.update(
      definition({
        name: 'DEV_PIN',
        value: '1234',
        bindings: [],
        sandbox: 'env',
      }),
      BY,
      NOW,
      SecretUses.none(),
    ),
  );
  await saveSecret(secrets, 'secret_waiting', {
    name: 'DEV_DATABASE_URL',
    value: null,
    valueVersion: null,
    bindings: [],
    sandbox: 'env',
  });

  return { reveals: new SandboxEnvReveals(secrets, store, logger), logger };
};

const revealing = (sandboxEnv: { variable: string; secret: string }[]) => ({
  workspaceId: WORKSPACE.value,
  runId: 'run_1',
  sandboxEnv,
});

describe('SandboxEnvReveals', () => {
  it('gives each variable the value of a secret that allows the sandbox, and logs which secrets it gave', async () => {
    const { reveals, logger } = await setUp();

    const revealed = await reveals.reveal(
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

  it('denies a value stored before the secret allowed sandboxes that does not fit the sandbox', async () => {
    const { reveals, logger } = await setUp();

    const revealed = await reveals.reveal(
      revealing([{ variable: 'PIN', secret: 'DEV_PIN' }]),
    );

    expect(revealed.variables).toEqual([]);
    expect(revealed.denied).toEqual([
      {
        secret: 'DEV_PIN',
        reason:
          'The value of secret DEV_PIN must have at least 8 characters that are not whitespace, and no NUL byte, since a run gets DEV_PIN in its sandbox. Set a new value.',
      },
    ]);
    expect(logger.informed).toEqual([]);
  });

  it('denies a secret that does not allow the sandbox, one without a value and one the workspace does not have', async () => {
    const { reveals, logger } = await setUp();

    const revealed = await reveals.reveal(
      revealing([
        { variable: 'LINEAR_API_KEY', secret: 'LINEAR_API_KEY' },
        { variable: 'DATABASE_URL', secret: 'DEV_DATABASE_URL' },
        { variable: 'GONE', secret: 'GONE' },
      ]),
    );

    expect(revealed.variables).toEqual([]);
    expect(revealed.denied).toEqual([
      {
        secret: 'LINEAR_API_KEY',
        reason:
          'Secret LINEAR_API_KEY does not allow its value in a sandbox. Set sandbox = "env" on the secret.',
      },
      {
        secret: 'DEV_DATABASE_URL',
        reason:
          'Secret DEV_DATABASE_URL has no value. Set it on the Secrets settings page, with spotlight secret set DEV_DATABASE_URL, or with value_wo and value_wo_version in Terraform.',
      },
      {
        secret: 'GONE',
        reason: 'Secret GONE not found. Please create it first.',
      },
    ]);
    expect(logger.informed).toEqual([]);
  });
});
