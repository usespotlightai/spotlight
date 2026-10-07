import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';

export const MEMORY_REACHES = ['team', 'line', 'station'] as const;

export type MemoryReach = (typeof MEMORY_REACHES)[number];

export const parseMemoryReach = (raw: string): MemoryReach => {
  const reach = MEMORY_REACHES.find((each) => each === raw.trim());

  if (!reach) {
    throw new InvalidMemoryError(
      `reach must be one of ${MEMORY_REACHES.join(', ')}, not ${raw}`,
    );
  }

  return reach;
};
