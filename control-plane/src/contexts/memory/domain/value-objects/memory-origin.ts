export const MEMORY_ORIGINS = ['drafted', 'remembered'] as const;

export type MemoryOrigin = (typeof MEMORY_ORIGINS)[number];
