import { CreateSecretCommand } from '@secrets/application/commands/create-secret.command';
import { DeleteSecretCommand } from '@secrets/application/commands/delete-secret.command';
import { CreateSecretHandler } from '@secrets/application/commands/handlers/create-secret.handler';
import { DeleteSecretHandler } from '@secrets/application/commands/handlers/delete-secret.handler';
import { UpdateSecretHandler } from '@secrets/application/commands/handlers/update-secret.handler';
import { UpdateSecretCommand } from '@secrets/application/commands/update-secret.command';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { SecretDefinitions } from '@secrets/infrastructure/definitions/secret-definitions';
import {
  ADMIN,
  accessFor,
  BY,
  InMemoryCreates,
  InMemorySecrets,
  InMemoryStore,
  NOW,
  transaction,
  WORKSPACE,
} from '@secrets/secrets.fakes.fake-spec';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { changesConfiguration } from '@shared-kernel/domain/events/configuration-changed';
import { dottedOf } from '@shared-kernel/domain/value-objects/field-path.fake-spec';
import { describe, expect, it } from 'vitest';

const LINEAR = {
  name: 'LINEAR_API_KEY',
  bindings: [{ host: 'api.linear.app', prefix: 'Bearer ' }],
  valueWo: 'lin_api_1',
  valueWoVersion: 1,
};

const ID = 'secret_new';

const holding = (managesSecrets = true) => {
  const store = new InMemoryStore();
  const secrets = new InMemorySecrets(store);
  const creates = new InMemoryCreates();
  const as = { managesSecrets };
  const access = accessFor(() => as.managesSecrets);
  const clock = { now: () => NOW, sleep: async () => undefined };
  const definitions = new SecretDefinitions();

  const creating = new CreateSecretHandler(
    access,
    definitions,
    secrets,
    creates,
    { generate: () => ID },
    clock,
    transaction,
  );
  const updating = new UpdateSecretHandler(
    access,
    definitions,
    secrets,
    clock,
    transaction,
  );
  const uses: string[] = [];
  const deleting = new DeleteSecretHandler(
    access,
    secrets,
    { register: () => undefined, of: async () => uses },
    transaction,
  );

  const keptValue = async () => {
    const secret = await secrets.withId(SecretId.of(ID));

    return secret ? (await store.read(secret)).revealed() : null;
  };

  return {
    create: (definition: unknown = LINEAR, key = 'key-1') =>
      creating.execute(
        new CreateSecretCommand(WORKSPACE.value, ADMIN, key, definition),
      ),
    update: (definition: unknown, version = 1) =>
      updating.execute(new UpdateSecretCommand(ID, ADMIN, version, definition)),
    remove: (version = 1) =>
      deleting.execute(new DeleteSecretCommand(ID, ADMIN, version)),
    secrets,
    store,
    creates,
    uses,
    keptValue,
    demoted: () => {
      as.managesSecrets = false;
    },
  };
};

const created = async () => {
  const held = holding();
  await held.create();

  return held;
};

describe('CreateSecretHandler', () => {
  it('sets the secret and keeps its value', async () => {
    const { create, keptValue, secrets } = holding();

    expect(await create()).toEqual({
      outcome: 'created',
      id: ID,
      replayed: false,
    });
    expect(await keptValue()).toBe('lin_api_1');
    expect(secrets.events.map((each) => each.kind)).toEqual(['secret.set']);
  });

  it('forbids someone who reads the workspace but may not manage its secrets', async () => {
    const { create, secrets } = holding(false);

    expect(await create()).toEqual(forbiddenTo('manage-secrets'));
    expect(await secrets.withId(SecretId.of(ID))).toBeNull();
  });

  it('never remembers the value alongside the idempotency key', async () => {
    const { create, creates } = holding();

    await create();

    expect(creates.requests.join()).not.toContain('lin_api_1');
  });

  it('points at the field that is wrong', async () => {
    const { create } = holding();
    const answered = await create({ ...LINEAR, valueWo: undefined });

    expect(answered?.outcome).toBe('invalid');
    expect(
      answered?.outcome === 'invalid' &&
        answered.problems.map((each) => dottedOf(each.field)),
    ).toEqual(['valueWo']);
  });

  it('says a name the workspace already holds is taken', async () => {
    const { create } = await created();

    expect(await create(LINEAR, 'key-2')).toEqual({
      outcome: 'taken',
      address: 'LINEAR_API_KEY',
    });
  });
});

describe('UpdateSecretHandler', () => {
  it('rotates the value when valueWoVersion changes, with nothing redeployed', async () => {
    const { update, keptValue } = await created();

    expect(
      await update({ ...LINEAR, valueWo: 'lin_api_2', valueWoVersion: 2 }),
    ).toEqual({ outcome: 'updated', id: ID });
    expect(await keptValue()).toBe('lin_api_2');
  });

  it('leaves the value alone while valueWoVersion stands', async () => {
    const { update, keptValue } = await created();

    await update({ ...LINEAR, valueWo: 'lin_api_ignored' });

    expect(await keptValue()).toBe('lin_api_1');
  });

  it('refuses a new valueWoVersion without the value, keeping the old one', async () => {
    const { update, keptValue } = await created();
    const answered = await update({
      ...LINEAR,
      valueWo: undefined,
      valueWoVersion: 2,
    });

    expect(
      answered?.outcome === 'invalid' &&
        answered.problems.map((each) => dottedOf(each.field)),
    ).toEqual(['valueWo']);
    expect(await keptValue()).toBe('lin_api_1');
  });

  it('refuses a rename at the name', async () => {
    const { update } = await created();
    const answered = await update({ ...LINEAR, name: 'LINEAR_TOKEN' });

    expect(
      answered?.outcome === 'invalid' &&
        answered.problems.map((each) => dottedOf(each.field)),
    ).toEqual(['name']);
  });

  it('refuses a change to a version no longer current', async () => {
    const { update } = await created();

    expect(await update(LINEAR, 0)).toEqual({
      outcome: 'version-conflict',
      currentVersion: 1,
    });
  });

  it('forbids someone who may no longer manage the workspace’s secrets', async () => {
    const { update, keptValue, demoted } = await created();

    demoted();

    expect(
      await update({ ...LINEAR, valueWo: 'lin_api_2', valueWoVersion: 2 }),
    ).toEqual(forbiddenTo('manage-secrets'));
    expect(await keptValue()).toBe('lin_api_1');
  });

  it('records one change saying who rebound and rotated it, and never the value', async () => {
    const { update, secrets } = await created();

    await update({
      ...LINEAR,
      bindings: [{ host: 'uploads.linear.app' }],
      valueWo: 'lin_api_2',
      valueWoVersion: 2,
    });

    expect(secrets.events.map((each) => each.kind)).toEqual([
      'secret.set',
      'secret.redefined',
    ]);
    expect(secrets.events[1]).toMatchObject({
      change: { action: 'updated', by: BY },
    });
    expect(
      secrets.events.filter(changesConfiguration)[1]?.change.recordedDetail,
    ).toEqual({
      valueVersion: 2,
      boundTo: ['uploads.linear.app'],
    });
    expect(JSON.stringify(secrets.events)).not.toMatch(/lin_api_/);
  });
});

describe('DeleteSecretHandler', () => {
  it('deletes the secret and forgets its value', async () => {
    const { remove, store, secrets } = await created();

    expect(await remove()).toEqual({ outcome: 'deleted' });
    expect(store.holds(SecretId.of(ID))).toBe(false);
    expect(secrets.events[secrets.events.length - 1]).toMatchObject({
      kind: 'secret.deleted',
      change: { action: 'deleted', by: BY },
    });
  });

  it('will not delete a secret an integration still wears, and says which', async () => {
    const { remove, keptValue, uses } = await created();

    uses.push('integration core/linear');

    expect(await remove()).toEqual({
      outcome: 'in-use',
      reason: expect.stringContaining('integration core/linear'),
    });
    expect(await keptValue()).toBe('lin_api_1');
  });

  it('forbids someone who may no longer manage the workspace’s secrets', async () => {
    const { remove, keptValue, demoted } = await created();

    demoted();

    expect(await remove()).toEqual(forbiddenTo('manage-secrets'));
    expect(await keptValue()).toBe('lin_api_1');
  });
});
