import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const MOST_REASON = 500;

export class MemoryRetirement {
  private constructor(
    readonly at: Date,
    readonly by: UserId | null,
    readonly reason: string | null,
    readonly supersededBy: MemoryId | null,
  ) {}

  static superseded(successor: MemoryId, at: Date): MemoryRetirement {
    return new MemoryRetirement(at, null, null, successor);
  }

  static retired(input: {
    by: UserId;
    reason: string;
    at: Date;
  }): MemoryRetirement {
    const reason = input.reason.trim();

    if (!reason || reason.length > MOST_REASON) {
      throw new InvalidMemoryError(
        `is retired with a reason of at most ${MOST_REASON} characters`,
      );
    }

    return new MemoryRetirement(input.at, input.by, reason, null);
  }

  static rehydrate(input: {
    at: Date;
    by: UserId | null;
    reason: string | null;
    supersededBy: MemoryId | null;
  }): MemoryRetirement {
    const superseded = input.supersededBy !== null;
    const explained = input.by !== null && input.reason !== null;

    if (superseded === explained) {
      throw new InconsistentStateError(
        'memory',
        'is retired both by a person and by a newer memory, or by neither',
      );
    }

    return new MemoryRetirement(
      input.at,
      input.by,
      input.reason,
      input.supersededBy,
    );
  }

  get superseded(): boolean {
    return this.supersededBy !== null;
  }

  equals(other: MemoryRetirement): boolean {
    return (
      this.at.getTime() === other.at.getTime() &&
      this.reason === other.reason &&
      this.by?.value === other.by?.value &&
      this.supersededBy?.value === other.supersededBy?.value
    );
  }
}
