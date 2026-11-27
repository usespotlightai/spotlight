import { CreateSecretCommand } from '@secrets/application/commands/create-secret.command';
import { CreateSecretHandler } from '@secrets/application/commands/handlers/create-secret.handler';
import { SetSecretValueHandler } from '@secrets/application/commands/handlers/set-secret-value.handler';
import { SetSecretValueCommand } from '@secrets/application/commands/set-secret-value.command';
import { Secret } from '@secrets/domain/aggregates/secret.aggregate';
import { SecretVersionConflictError } from '@secrets/domain/exceptions/secret-version-conflict.error';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { SecretDefinitions } from '@secrets/infrastructure/definitions/secret-definitions';
import {
  ADMIN,
  accessFor,
  BY,
  definition,
  InMemoryCreates,
  InMemorySecrets,
  InMemoryStore,
  NOW,
  SLUG,
  transaction,
  WORKSPACE,
} from '@secrets/testing/secrets.fakes.fake-spec';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { TranslatedDomainError } from '@shared-kernel/application/errors/translated-domain-error';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { describe, expect, it } from 'vitest';

const AWAITING = {
  name: 'STAGING_LOGIN_PASSWORD',
  bindings: [{ host: 'staging.example.com' }],
};

const FROM_TERRAFORM = {
  name: 'LINEAR_API_KEY',
  bindings: [{ host: 'api.linear.app', prefix: 'Bearer ' }],
  valueWo: 'lin_api_1',
  valueWoVersion: 1,
};

const setUp = async (managesSecrets = true) => {
  const store = new InMemoryStore();
  const secrets = new InMemorySecrets(store);
  const as = { managesSecrets: true };
  const access = accessFor(() => as.managesSecrets);
  const clock = { now: () => NOW, sleep: async () => {} };
  let next = 0;
  const creating = new CreateSecretHandler(
    access,
    new SecretDefinitions(),
    secrets,
    new InMemoryCreates(),
    { generate: () => `secret_${(next += 1)}` },
    clock,
    transaction,
  );

  for (const definition of [AWAITING, FROM_TERRAFORM]) {
    await creating.execute(
      new CreateSecretCommand(
        WORKSPACE.value,
        ADMIN,
        definition.name,
        definition,
      ),
    );
  }

  as.managesSecrets = managesSecrets;
  const setting = new SetSecretValueHandler(
    access,
    secrets,
    clock,
    transaction,
  );

  return {
    secrets,
    set: (name: string, value: string, slug = SLUG) =>
      setting.execute(new SetSecretValueCommand(slug, name, ADMIN, value)),
    storedValue: async (name: string) => {
      const secret = await secrets.named(WORKSPACE, SecretName.of(name));

      return secret?.holdsValue ? (await store.read(secret)).revealed() : null;
    },
  };
};

describe('SetSecretValueHandler', () => {
  it('stores the value of a secret that awaits one', async () => {
    const { set, storedValue } = await setUp();

    expect(await set('STAGING_LOGIN_PASSWORD', 'hunter2')).toEqual({
      outcome: 'set',
    });
    expect(await storedValue('STAGING_LOGIN_PASSWORD')).toBe('hunter2');
  });

  it('forbids someone who may not manage secrets', async () => {
    const { set, storedValue } = await setUp(false);

    expect(await set('STAGING_LOGIN_PASSWORD', 'hunter2')).toEqual(
      forbiddenTo('secrets'),
    );
    expect(await storedValue('STAGING_LOGIN_PASSWORD')).toBeNull();
  });

  it('finds nothing in another workspace or under another name', async () => {
    const { set } = await setUp();

    expect(await set('STAGING_LOGIN_PASSWORD', 'hunter2', 'other')).toBeNull();
    expect(await set('NOT_THERE', 'hunter2')).toBeNull();
  });

  it('refuses a value that Terraform sets', async () => {
    const { set, storedValue } = await setUp();

    await expect(set('LINEAR_API_KEY', 'lin_api_2')).rejects.toThrow(
      TranslatedDomainError,
    );
    expect(await storedValue('LINEAR_API_KEY')).toBe('lin_api_1');
  });

  it('finds no secret that Spotlight keeps for itself', async () => {
    const { set } = await setUp();

    expect(await set('SPOTLIGHT_ANTHROPIC_API_KEY', 'x')).toBeNull();
  });

  it('finds no secret that Spotlight keeps for itself, under a name with spaces around it', async () => {
    const { set, secrets, storedValue } = await setUp();
    await secrets.save(
      Secret.create(
        definition({
          name: 'SPOTLIGHT_GITHUB_KEY',
          value: null,
          valueVersion: null,
        }),
        {
          id: SecretId.of('secret_reserved'),
          workspaceId: WORKSPACE,
          by: BY,
          at: NOW,
        },
      ),
    );

    expect(await set(' SPOTLIGHT_GITHUB_KEY ', 'x')).toBeNull();
    expect(await storedValue('SPOTLIGHT_GITHUB_KEY')).toBeNull();
  });

  it('refuses a value when the secret changed while it was being set', async () => {
    const { secrets, set, storedValue } = await setUp();
    const stale = await secrets.named(
      WORKSPACE,
      SecretName.of('STAGING_LOGIN_PASSWORD'),
    );
    await set('STAGING_LOGIN_PASSWORD', 'hunter2');
    const racing = new SetSecretValueHandler(
      accessFor(() => true),
      {
        withId: (id) => secrets.withId(id),
        named: async () => stale,
        inWorkspace: (workspaceId) => secrets.inWorkspace(workspaceId),
        save: (secret) => secrets.save(secret),
      },
      { now: () => NOW, sleep: async () => {} },
      transaction,
    );

    await expect(
      racing.execute(
        new SetSecretValueCommand(
          SLUG,
          'STAGING_LOGIN_PASSWORD',
          ADMIN,
          'hunter3',
        ),
      ),
    ).rejects.toSatisfy(
      (error) =>
        error instanceof TranslatedDomainError &&
        error.refusal instanceof SecretVersionConflictError,
    );
    expect(await storedValue('STAGING_LOGIN_PASSWORD')).toBe('hunter2');
  });

  it('refuses a value on more than one line', async () => {
    const { set } = await setUp();

    await expect(set('STAGING_LOGIN_PASSWORD', 'a\nb')).rejects.toThrow(
      /one line/,
    );
  });
});
