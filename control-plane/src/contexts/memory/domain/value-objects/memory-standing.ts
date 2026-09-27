export const MEMORY_STANDINGS = ['stands', 'retired'] as const;

export type MemoryStanding = (typeof MEMORY_STANDINGS)[number];
