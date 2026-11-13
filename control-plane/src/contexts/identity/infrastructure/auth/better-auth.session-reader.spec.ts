import type { AppAuth } from '@identity/infrastructure/auth/auth';
import { BetterAuthSessionReader } from '@identity/infrastructure/auth/better-auth.session-reader';
import { APIError } from 'better-auth/api';
import { describe, expect, it, vi } from 'vitest';

const readerFailingWith = (getSession: () => Promise<unknown>) =>
  new BetterAuthSessionReader({
    api: { getSession: vi.fn(getSession) },
  } as unknown as AppAuth);

describe('BetterAuthSessionReader', () => {
  it('maps a valid session to the session user', async () => {
    const reader = readerFailingWith(async () => ({
      user: { id: 'u1', email: 'a@b.c', name: 'Ann', image: 'x' },
    }));

    await expect(reader.read({})).resolves.toEqual({
      id: 'u1',
      email: 'a@b.c',
      name: 'Ann',
    });
  });

  it('returns null when better-auth finds no session', async () => {
    const reader = readerFailingWith(async () => null);

    await expect(reader.read({})).resolves.toBeNull();
  });

  it('returns null when the session is lost to a concurrent delete', async () => {
    const reader = readerFailingWith(async () => {
      throw new APIError('UNAUTHORIZED', { message: 'Failed to get session' });
    });

    await expect(reader.read({})).resolves.toBeNull();
    await expect(reader.readBearer('token')).resolves.toBeNull();
  });

  it('rethrows an internal better-auth error', async () => {
    const error = new APIError('INTERNAL_SERVER_ERROR', {
      message: 'Failed to get session',
    });
    const reader = readerFailingWith(async () => {
      throw error;
    });

    await expect(reader.read({})).rejects.toBe(error);
  });

  it('rethrows a plain error', async () => {
    const error = new Error('database down');
    const reader = readerFailingWith(async () => {
      throw error;
    });

    await expect(reader.readBearer('token')).rejects.toBe(error);
  });
});
