export const MEMORY_USES = [
  'briefed',
  'read',
  'recalled',
  'delivered',
] as const;

export type MemoryUse = (typeof MEMORY_USES)[number];

export const LOOKED_UP: readonly MemoryUse[] = [
  'read',
  'recalled',
  'delivered',
];
