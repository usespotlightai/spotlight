export type MemoryDraftingTrouble = 'refused' | 'unreadable';

export class MemoryDraftingError extends Error {
  constructor(
    readonly trouble: MemoryDraftingTrouble,
    reason: string,
  ) {
    super(`Memories could not be drafted: ${reason}`);
    this.name = 'MemoryDraftingError';
  }
}
