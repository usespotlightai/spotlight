import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';

export const MEMORY_KINDS = [
  'rationale',
  'rejected-approach',
  'failure',
  'environment',
  'preference',
  'correction',
] as const;

export type MemoryKind = (typeof MEMORY_KINDS)[number];

export const parseMemoryKind = (raw: string): MemoryKind => {
  const kind = MEMORY_KINDS.find((each) => each === raw.trim());

  if (!kind) {
    throw new InvalidMemoryError(
      `kind must be one of ${MEMORY_KINDS.join(', ')}, not ${raw}`,
    );
  }

  return kind;
};

const WARNINGS: readonly MemoryKind[] = [
  'failure',
  'rejected-approach',
  'correction',
];

export const isWarning = (kind: MemoryKind): boolean => WARNINGS.includes(kind);
