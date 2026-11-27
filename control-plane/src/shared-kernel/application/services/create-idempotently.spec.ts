import type {
  IdempotentCreatesPort,
  IdempotentReservation,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import type {
  IdempotentLookup,
  IdempotentLookupsPort,
} from '@shared-kernel/application/ports/idempotent-lookups.port';
import {
  createIdempotently,
  lookupIdempotentCreate,
} from '@shared-kernel/application/services/create-idempotently';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';
import { describe, expect, it, vi } from 'vitest';

const CREATE = { by: 'user_1', key: IdempotencyKey.of('key-1'), request: {} };

const reserving = (reservation: IdempotentReservation) => {
  const creates = {
    reserve: vi.fn(async () => reservation),
    recordCreated: vi.fn(async () => {}),
  } satisfies IdempotentCreatesPort;
  const make = vi.fn(async () => 'made_1');

  return {
    creates,
    make,
    run: () => createIdempotently(creates, CREATE, make),
  };
};

describe('createIdempotently', () => {
  it('makes the resource under a new key, and records what the key made', async () => {
    const { run, creates, make } = reserving({ kind: 'new' });

    expect(await run()).toEqual({
      outcome: 'created',
      id: 'made_1',
      replayed: false,
    });
    expect(make).toHaveBeenCalledTimes(1);
    expect(creates.recordCreated).toHaveBeenCalledWith(CREATE, 'made_1');
  });

  it('returns what the first attempt made for a retry, making nothing', async () => {
    const { run, make } = reserving({
      kind: 'already-created',
      createdId: 'made_0',
    });

    expect(await run()).toEqual({
      outcome: 'created',
      id: 'made_0',
      replayed: true,
    });
    expect(make).not.toHaveBeenCalled();
  });

  it('rejects a key used for another request', async () => {
    const { run, make } = reserving({ kind: 'key-reused' });

    expect(await run()).toEqual({ outcome: 'idempotency-key-reused' });
    expect(make).not.toHaveBeenCalled();
  });

  it('records nothing when making the resource fails', async () => {
    const { run, creates, make } = reserving({ kind: 'new' });

    make.mockRejectedValueOnce(new Error('exists'));

    await expect(run()).rejects.toThrow('exists');
    expect(creates.recordCreated).not.toHaveBeenCalled();
  });
});

describe('lookupIdempotentCreate', () => {
  const lookingUp = (lookup: IdempotentLookup) =>
    lookupIdempotentCreate(
      { lookup: async () => lookup } satisfies IdempotentLookupsPort,
      CREATE,
    );

  it('says nothing of a key it has not seen, so the create goes ahead', async () => {
    expect(await lookingUp({ kind: 'new' })).toBeNull();
  });

  it('returns what the key created for a retry', async () => {
    expect(
      await lookingUp({ kind: 'already-created', createdId: 'made_0' }),
    ).toEqual({
      outcome: 'created',
      id: 'made_0',
      replayed: true,
    });
  });

  it('rejects a key used for another request', async () => {
    expect(await lookingUp({ kind: 'key-reused' })).toEqual({
      outcome: 'idempotency-key-reused',
    });
  });
});
