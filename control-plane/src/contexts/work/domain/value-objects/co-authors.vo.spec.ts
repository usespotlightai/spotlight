import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { TooManyCoAuthorsError } from '@work/domain/exceptions/too-many-co-authors.error';
import { CoAuthors } from '@work/domain/value-objects/co-authors.vo';
import { describe, expect, it } from 'vitest';

const people = (...ids: string[]) => ids.map((each) => UserId.of(each));

describe('CoAuthors', () => {
  it('names each person once, and keeps only those who wrote in the draft', () => {
    const named = CoAuthors.named(people('ada', 'bea', 'ada'));

    expect(named.named.map((each) => each.value)).toEqual(['ada', 'bea']);
    expect(
      named.whoWrote(people('bea', 'cy')).map((each) => each.value),
    ).toEqual(['bea']);
  });

  it('names at most twenty people', () => {
    const many = people(...Array.from({ length: 21 }, (_, at) => `user_${at}`));

    expect(() => CoAuthors.named(many)).toThrow(TooManyCoAuthorsError);
    expect(CoAuthors.named(many.slice(0, 20)).named).toHaveLength(20);
  });
});
