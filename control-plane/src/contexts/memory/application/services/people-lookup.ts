import type { PersonDto } from '@memory/application/dto/memory-review.dto';
import type { PeoplePort } from '@memory/application/ports/people.port';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export type PersonLookup = (id: UserId) => Promise<PersonDto>;

export const lookUpOnce = (people: PeoplePort): PersonLookup => {
  const found = new Map<string, Promise<PersonDto>>();

  return (id) => {
    const known = found.get(id.value);

    if (known) {
      return known;
    }

    const looked = people.find(id).then((person) => ({
      id: id.value,
      name: person?.name ?? null,
      image: person?.image ?? null,
    }));
    found.set(id.value, looked);

    return looked;
  };
};
