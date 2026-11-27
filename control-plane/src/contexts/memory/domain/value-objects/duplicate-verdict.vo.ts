import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';

const MAX_REASON = 500;

/** Whether one proposal repeats a memory of its team, and why, in one plain sentence. */
export class DuplicateVerdict {
  private constructor(
    readonly proposal: MemoryId,
    readonly repeats: MemoryId | null,
    readonly reason: string,
  ) {}

  static of(input: {
    proposal: MemoryId;
    repeats: MemoryId | null;
    reason: string;
  }): DuplicateVerdict {
    const reason = input.reason.trim();

    return new DuplicateVerdict(
      input.proposal,
      input.repeats,
      reason.length > MAX_REASON
        ? `${reason.slice(0, MAX_REASON - 1)}…`
        : reason,
    );
  }

  isAbout(proposal: MemoryId): boolean {
    return this.proposal.equals(proposal);
  }
}
