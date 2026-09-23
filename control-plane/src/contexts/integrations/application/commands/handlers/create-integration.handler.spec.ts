import { CreateIntegrationCommand } from '@integrations/application/commands/create-integration.command';
import { CreateIntegrationHandler } from '@integrations/application/commands/handlers/create-integration.handler';
import type { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import { IntegrationAlreadyDefinedError } from '@integrations/domain/exceptions/integration-already-defined.error';
import {
  access,
  compiler,
  creates,
  definitions,
  LINEAR,
  TEAM,
  teams,
} from '@integrations/integrations.resources.fake-spec';
import type { IdempotentClaim } from '@shared-kernel/application/ports/idempotent-creates.port';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { describe, expect, it } from 'vitest';

const creating = (
  over: {
    administers?: boolean;
    claim?: IdempotentClaim;
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
    compiler,
    kept,
    keys,
    { generate: () => 'integration_new' },
    {
      run: async (work) => {
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
        new CreateIntegrationCommand(TEAM.value, 'user_1', 'key-1', definition),
      ),
    kept,
    keys,
  };
};

describe('CreateIntegrationHandler', () => {
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
      expect.objectContaining({ by: 'user_1' }),
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

  it('creates nothing for someone who does not administer the team', async () => {
    const { create, kept } = creating({ administers: false });

    expect(await create(LINEAR)).toBeNull();
    expect(kept.save).not.toHaveBeenCalled();
  });
});
