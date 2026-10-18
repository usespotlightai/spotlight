import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';

export const MEMORY_STATUSES = ['active', 'retired'] as const;

export type MemoryStatus = (typeof MEMORY_STATUSES)[number];

export const parseMemoryStatus = (raw: string): MemoryStatus => {
  const status = MEMORY_STATUSES.find((each) => each === raw.trim());

  if (!status) {
    throw new InvalidMemoryError(
      `status must be active or retired, not ${raw}`,
    );
  }

  return status;
};
