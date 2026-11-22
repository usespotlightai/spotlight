export const MEMORY_CREATIONS = ['added', 'corrected', 'merged'] as const;

export type MemoryCreation = (typeof MEMORY_CREATIONS)[number];
