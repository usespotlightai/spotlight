export const MEMORY_USES = ['briefed', 'recalled'] as const;

export type MemoryUse = (typeof MEMORY_USES)[number];
