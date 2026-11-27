import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const nameOf = async (
  people: PersonReaderPort,
  id: UserId,
): Promise<string> => {
  const name = (await people.find(id))?.name.trim();

  return name !== undefined && name !== '' ? name : 'Someone';
};
