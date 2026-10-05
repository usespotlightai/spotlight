import type {
  IdempotentClaim,
  IdempotentCreatesPort,
} from '@shared-kernel/application/ports/idempotent-creates.port';
import type {
  IdempotentRecall,
  IdempotentRecallsPort,
} from '@shared-kernel/application/ports/idempotent-recalls.port';
import {
  createdEarlier,
  createdOnce,
} from '@shared-kernel/application/services/created-once';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';
import { describe, expect, it, vi } from 'vitest';

const CREATE = { by: 'user_1', key: IdempotencyKey.of('key-1'), request: {} };

const claiming = (claim: IdempotentClaim) => {
  const creates = {
    claim: vi.fn(async () => claim),
    created: vi.fn(async () => {}),
  } satisfies IdempotentCreatesPort;
  const make = vi.fn(async () => 'made_1');

  return { creates, make, run: () => createdOnce(creates, CREATE, make) };
};

describe('createdOnce', () => {
  it('makes the resource under a fresh key, and records what the key made', async () => {
    const { run, creates, make } = claiming({ kind: 'fresh' });

    expect(await run()).toEqual({
      outcome: 'created',
      id: 'made_1',
      replayed: false,
    });
    expect(make).toHaveBeenCalledTimes(1);
    expect(creates.created).toHaveBeenCalledWith(CREATE, 'made_1');
  });

  it('answers a retry with what the first attempt made, making nothing', async () => {
    const { run, make } = claiming({ kind: 'replay', createdId: 'made_0' });

    expect(await run()).toEqual({
      outcome: 'created',
      id: 'made_0',
      replayed: true,
    });
    expect(make).not.toHaveBeenCalled();
  });

  it('refuses a key used for another request', async () => {
    const { run, make } = claiming({ kind: 'reused' });

    expect(await run()).toEqual({ outcome: 'key-reused' });
    expect(make).not.toHaveBeenCalled();
  });

  it('records nothing when making the resource fails', async () => {
    const { run, creates, make } = claiming({ kind: 'fresh' });

    make.mockRejectedValueOnce(new Error('taken'));

    await expect(run()).rejects.toThrow('taken');
    expect(creates.created).not.toHaveBeenCalled();
  });
});

describe('createdEarlier', () => {
  const recalling = (recall: IdempotentRecall) =>
    createdEarlier(
      { recall: async () => recall } satisfies IdempotentRecallsPort,
      CREATE,
    );

  it('says nothing of a key it has not seen, so the create goes ahead', async () => {
    expect(await recalling({ kind: 'unseen' })).toBeNull();
  });

  it('answers a retry with what the key created', async () => {
    expect(await recalling({ kind: 'replay', createdId: 'made_0' })).toEqual({
      outcome: 'created',
      id: 'made_0',
      replayed: true,
    });
  });

  it('refuses a key used for another request', async () => {
    expect(await recalling({ kind: 'reused' })).toEqual({
      outcome: 'key-reused',
    });
  });
});
