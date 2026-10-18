import { CreateIntegrationCommand } from '@integrations/application/commands/create-integration.command';
import { CreateIntegrationHandler } from '@integrations/application/commands/handlers/create-integration.handler';
import type { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { IntegrationAlreadyExistsError } from '@integrations/domain/exceptions/integration-already-exists.error';
import {
  access,
  creates,
  definitions,
  LINEAR,
  lookups,
  specs,
  TEAM,
  teams,
} from '@integrations/integrations.resources.fake-spec';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { IdempotentReservation } from '@shared-kernel/application/ports/idempotent-creates.port';
import type { IdempotentLookup } from '@shared-kernel/application/ports/idempotent-lookups.port';
import { actorFor } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { afterEach, describe, expect, it, vi } from 'vitest';

const creating = (
  over: {
    isAdmin?: boolean;
    reservation?: IdempotentReservation;
    lookup?: IdempotentLookup;
    failing?: Error;
  } = {},
) => {
  const repository = definitions({ failing: over.failing });
  const keys = creates(over.reservation);
  const within: string[] = [];
  let open = false;
  const handler = new CreateIntegrationHandler(
    access(over.isAdmin),
    teams(),
    specs,
    repository,
    keys,
    lookups(over.lookup),
    { generate: () => 'integration_new' },
    {
      inTransaction: async (work) => {
        open = true;
        try {
          return await work();
        } finally {
          open = false;
        }
      },
    },
  );

  const noted = (name: string) => within.push(open ? name : `${name} outside`);

  keys.reserve.mockImplementation(async () => {
    noted('reserve');
    return over.reservation ?? { kind: 'new' };
  });
  repository.save.mockImplementation(async () => {
    noted('save');

    if (over.failing) {
      throw over.failing;
    }
  });
  keys.recordCreated.mockImplementation(async () => {
    noted('recordCreated');
  });

  return {
    within,
    create: (definition: unknown) =>
      handler.execute(
        new CreateIntegrationCommand(
          TEAM.value,
          actorFor('user_1'),
          'key-1',
          definition,
        ),
      ),
    repository,
    keys,
  };
};

describe('CreateIntegrationHandler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reserves the key, creates, and records what the key created in one transaction', async () => {
    const { create, within } = creating();

    await create(LINEAR);

    expect(within).toEqual(['reserve', 'save', 'recordCreated']);
  });

  it('creates the integration under an id it issues, and records what the key created', async () => {
    const { create, repository, keys } = creating();

    expect(await create(LINEAR)).toEqual({
      outcome: 'created',
      id: 'integration_new',
      replayed: false,
    });

    const [saved] = repository.save.mock.calls[0] as [IntegrationDefinition];

    expect(saved.isNew).toBe(true);
    expect(saved.teamId).toEqual(TEAM);
    expect(keys.recordCreated).toHaveBeenCalledWith(
      expect.objectContaining({ by: 'person:user_1' }),
      'integration_new',
    );
  });

  it('answers a retry with what the key created, creating nothing more', async () => {
    const { create, repository } = creating({
      reservation: { kind: 'already-created', createdId: 'integration_first' },
    });

    expect(await create(LINEAR)).toEqual({
      outcome: 'created',
      id: 'integration_first',
      replayed: true,
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('answers a retry the key already created from what it created, reading nothing again', async () => {
    const reading = vi.spyOn(specs, 'compiled');
    const { create, repository, keys } = creating({
      lookup: { kind: 'already-created', createdId: 'integration_first' },
    });

    expect(await create(LINEAR)).toEqual({
      outcome: 'created',
      id: 'integration_first',
      replayed: true,
    });
    expect(reading).not.toHaveBeenCalled();
    expect(keys.reserve).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('rejects a key already used for a different request before reading anything', async () => {
    const reading = vi.spyOn(specs, 'compiled');
    const { create, repository, keys } = creating({
      lookup: { kind: 'key-reused' },
    });

    expect(await create(LINEAR)).toEqual({ outcome: 'idempotency-key-reused' });
    expect(reading).not.toHaveBeenCalled();
    expect(keys.reserve).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('rejects a key used for a different request', async () => {
    const { create, repository } = creating({
      reservation: { kind: 'key-reused' },
    });

    expect(await create(LINEAR)).toEqual({ outcome: 'idempotency-key-reused' });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('answers a create for an integration the team already has with its address', async () => {
    const { create, keys } = creating({
      failing: new IntegrationAlreadyExistsError('linear'),
    });

    expect(await create(LINEAR)).toEqual({
      outcome: 'already-exists',
      address: 'core/linear',
    });
    expect(keys.recordCreated).not.toHaveBeenCalled();
  });

  it('says what is wrong with one that will not compile, and stores nothing', async () => {
    const { create, repository, keys } = creating();

    expect(await create({ integration: 'linear' })).toMatchObject({
      outcome: 'invalid',
      problems: [{ field: FieldPath.dotted('actions.comment.request.url') }],
    });
    expect(repository.save).not.toHaveBeenCalled();
    expect(keys.reserve).not.toHaveBeenCalled();
  });

  it('forbids someone on the team who does not administer it', async () => {
    const { create, repository } = creating({ isAdmin: false });

    expect(await create(LINEAR)).toEqual(forbiddenTo('configure'));
    expect(repository.save).not.toHaveBeenCalled();
  });
});
