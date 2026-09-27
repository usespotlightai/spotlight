export const MEMORY_REACHES = ['team', 'line', 'station'] as const;

export type MemoryReach = (typeof MEMORY_REACHES)[number];
