import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';

export const MEMORY_SCOPE_LEVELS = ['team', 'line', 'station'] as const;

export type MemoryScopeLevel = (typeof MEMORY_SCOPE_LEVELS)[number];

export const parseMemoryScopeLevel = (raw: string): MemoryScopeLevel => {
  const level = MEMORY_SCOPE_LEVELS.find((each) => each === raw.trim());

  if (!level) {
    throw new InvalidMemoryError(
      `scope must be one of ${MEMORY_SCOPE_LEVELS.join(', ')}, not ${raw}`,
    );
  }

  return level;
};
