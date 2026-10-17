export type MemoryDraftingErrorKind = 'refused' | 'unreadable';

export class MemoryDraftingError extends Error {
  constructor(
    readonly kind: MemoryDraftingErrorKind,
    reason: string,
  ) {
    super(`Memories could not be drafted: ${reason}`);
    this.name = 'MemoryDraftingError';
  }
}
