import type { PeoplePort } from '@memory/application/ports/people.port';
import { groundNotes } from '@memory/application/services/ground-notes';
import { lookUpOnce } from '@memory/application/services/people-lookup';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const people: PeoplePort = {
  memberOf: async () => null,
  find: async () => ({ name: 'Maya Chen', image: 'https://a/1.png' }),
};

describe('groundNotes', () => {
  it('names the teammate behind each cited note, and no one behind words from another tool', async () => {
    const found = await groundNotes(
      [
        { position: 1, by: 'person', author: UserId.of('user_1'), text: 'A.' },
        { position: 2, by: 'world', author: null, text: 'B.' },
        { position: 3, by: 'person', author: UserId.of('user_1'), text: 'C.' },
      ],
      [1, 2],
      lookUpOnce(people),
    );

    expect(found).toEqual([
      {
        position: 1,
        by: 'person',
        author: { id: 'user_1', name: 'Maya Chen', image: 'https://a/1.png' },
        text: 'A.',
      },
      { position: 2, by: 'world', author: null, text: 'B.' },
    ]);
  });
});
