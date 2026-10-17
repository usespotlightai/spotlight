import type { UnreplayableReason } from '@replays/domain/value-objects/unreplayable-reason';

export class UnreplayableEntryError extends Error {
  readonly violation = 'conflict' as const;

  constructor(
    readonly runId: string,
    readonly unreplayableReason: UnreplayableReason,
    reason: string,
  ) {
    super(`Run ${runId} cannot be replayed. ${reason}`);
    this.name = 'UnreplayableEntryError';
  }
}
