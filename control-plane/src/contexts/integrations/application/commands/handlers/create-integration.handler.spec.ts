import { CreateIntegrationCommand } from '@integrations/application/commands/create-integration.command';
import { CreateIntegrationHandler } from '@integrations/application/commands/handlers/create-integration.handler';
import type { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { IntegrationAlreadyDefinedError } from '@integrations/domain/exceptions/integration-already-defined.error';
import {
  access,
  creates,
  definitions,
  LINEAR,
  recalls,
  sources,
  TEAM,
  teams,
} from '@integrations/integrations.resources.fake-spec';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { IdempotentClaim } from '@shared-kernel/application/ports/idempotent-creates.port';
import type { IdempotentRecall } from '@shared-kernel/application/ports/idempotent-recalls.port';
import { actorFor } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { afterEach, describe, expect, it, vi } from 'vitest';

const creating = (
  over: {
    administers?: boolean;
    claim?: IdempotentClaim;
    recall?: IdempotentRecall;
    refusing?: Error;
  } = {},
) => {
  const kept = definitions({ refusing: over.refusing });
  const keys = creates(over.claim);
  const within: string[] = [];
  let open = false;
  const handler = new CreateIntegrationHandler(
    access(over.administers),
    teams(),
    sources,
    kept,
    keys,
    recalls(over.recall),
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

  keys.claim.mockImplementation(async () => {
    noted('claim');
    return over.claim ?? { kind: 'fresh' };
  });
  kept.save.mockImplementation(async () => {
    noted('save');

    if (over.refusing) {
      throw over.refusing;
    }
  });
  keys.created.mockImplementation(async () => {
    noted('created');
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
    kept,
    keys,
  };
};

describe('CreateIntegrationHandler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('claims the key, creates, and records what the key created in one transaction', async () => {
    const { create, within } = creating();

    await create(LINEAR);

    expect(within).toEqual(['claim', 'save', 'created']);
  });

  it('creates the integration under an id it issues, and records what the key created', async () => {
    const { create, kept, keys } = creating();

    expect(await create(LINEAR)).toEqual({
      outcome: 'created',
      id: 'integration_new',
      replayed: false,
    });

    const [saved] = kept.save.mock.calls[0] as [IntegrationDefinition];

    expect(saved.isNew).toBe(true);
    expect(saved.teamId).toEqual(TEAM);
    expect(keys.created).toHaveBeenCalledWith(
      expect.objectContaining({ by: 'person:user_1' }),
      'integration_new',
    );
  });

  it('answers a retry with what the key created, creating nothing more', async () => {
    const { create, kept } = creating({
      claim: { kind: 'replay', createdId: 'integration_first' },
    });

    expect(await create(LINEAR)).toEqual({
      outcome: 'created',
      id: 'integration_first',
      replayed: true,
    });
    expect(kept.save).not.toHaveBeenCalled();
  });

  it('answers a retry the key already created from what it created, reading nothing again', async () => {
    const reading = vi.spyOn(sources, 'compiled');
    const { create, kept, keys } = creating({
      recall: { kind: 'replay', createdId: 'integration_first' },
    });

    expect(await create(LINEAR)).toEqual({
      outcome: 'created',
      id: 'integration_first',
      replayed: true,
    });
    expect(reading).not.toHaveBeenCalled();
    expect(keys.claim).not.toHaveBeenCalled();
    expect(kept.save).not.toHaveBeenCalled();
  });

  it('refuses a key already used for a different request before reading anything', async () => {
    const reading = vi.spyOn(sources, 'compiled');
    const { create, kept, keys } = creating({ recall: { kind: 'reused' } });

    expect(await create(LINEAR)).toEqual({ outcome: 'key-reused' });
    expect(reading).not.toHaveBeenCalled();
    expect(keys.claim).not.toHaveBeenCalled();
    expect(kept.save).not.toHaveBeenCalled();
  });

  it('refuses a key used for a different request', async () => {
    const { create, kept } = creating({ claim: { kind: 'reused' } });

    expect(await create(LINEAR)).toEqual({ outcome: 'key-reused' });
    expect(kept.save).not.toHaveBeenCalled();
  });

  it('answers a create for a host the team already has with its address', async () => {
    const { create, keys } = creating({
      refusing: new IntegrationAlreadyDefinedError('linear'),
    });

    expect(await create(LINEAR)).toEqual({
      outcome: 'taken',
      address: 'core/linear',
    });
    expect(keys.created).not.toHaveBeenCalled();
  });

  it('says what is wrong with one that will not compile, and keeps nothing', async () => {
    const { create, kept, keys } = creating();

    expect(await create({ integration: 'linear' })).toMatchObject({
      outcome: 'invalid',
      problems: [{ field: FieldPath.dotted('actions.comment.request.url') }],
    });
    expect(kept.save).not.toHaveBeenCalled();
    expect(keys.claim).not.toHaveBeenCalled();
  });

  it('forbids someone on the team who does not administer it', async () => {
    const { create, kept } = creating({ administers: false });

    expect(await create(LINEAR)).toEqual(forbiddenTo('configure'));
    expect(kept.save).not.toHaveBeenCalled();
  });
});
