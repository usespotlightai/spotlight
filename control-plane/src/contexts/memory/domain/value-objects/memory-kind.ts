export const MEMORY_KINDS = [
  'rationale',
  'rejected-approach',
  'failure',
  'environment',
  'preference',
  'correction',
] as const;

export type MemoryKind = (typeof MEMORY_KINDS)[number];

export const isMemoryKind = (raw: string): raw is MemoryKind =>
  (MEMORY_KINDS as readonly string[]).includes(raw);

const WARNINGS: readonly MemoryKind[] = [
  'failure',
  'rejected-approach',
  'correction',
];

export const isWarning = (kind: MemoryKind): boolean => WARNINGS.includes(kind);
