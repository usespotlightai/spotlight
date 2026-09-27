export const MEMORY_SOURCES = ['person', 'run', 'outside'] as const;

export type MemorySource = (typeof MEMORY_SOURCES)[number];
