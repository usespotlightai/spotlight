export const MEMORY_PROPOSERS = ['drafter', 'agent'] as const;

export type MemoryProposer = (typeof MEMORY_PROPOSERS)[number];
