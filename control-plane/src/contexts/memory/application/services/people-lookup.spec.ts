import type { PeoplePort } from '@memory/application/ports/people.port';
import { lookUpOnce } from '@memory/application/services/people-lookup';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it, vi } from 'vitest';

describe('lookUpOnce', () => {
  it('looks each teammate up once', async () => {
    const find = vi.fn<PeoplePort['find']>(async () => ({
      name: 'Maya Chen',
      image: null,
    }));
    const person = lookUpOnce({ memberOf: async () => null, find });

    await Promise.all([
      person(UserId.of('user_1')),
      person(UserId.of('user_1')),
    ]);

    expect(find).toHaveBeenCalledTimes(1);
  });

  it('names no one it cannot find', async () => {
    const person = lookUpOnce({
      memberOf: async () => null,
      find: async () => null,
    });

    await expect(person(UserId.of('user_9'))).resolves.toEqual({
      id: 'user_9',
      name: null,
      image: null,
    });
  });
});
