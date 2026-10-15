import type { ReplayRefusal } from '@replays/domain/value-objects/replay-refusal';

export class UnreplayableEntryError extends Error {
  readonly violation = 'conflict' as const;

  constructor(
    readonly runId: string,
    readonly refusal: ReplayRefusal,
    reason: string,
  ) {
    super(`Run ${runId} cannot be replayed. ${reason}`);
    this.name = 'UnreplayableEntryError';
  }
}
