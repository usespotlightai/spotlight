import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';

export const MEMORY_STANDINGS = ['stands', 'retired'] as const;

export type MemoryStanding = (typeof MEMORY_STANDINGS)[number];

export const parseMemoryStanding = (raw: string): MemoryStanding => {
  const standing = MEMORY_STANDINGS.find((each) => each === raw.trim());

  if (!standing) {
    throw new InvalidMemoryError(`stands or is retired, and is never ${raw}`);
  }

  return standing;
};
