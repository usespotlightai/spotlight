import type { PrincipalRef } from '@configuration/domain/value-objects/principal-ref.vo';
import type { StateLockId } from '@configuration/domain/value-objects/state-lock-id.vo';

export type LockAsWritten = Readonly<Record<string, unknown>>;

export class StateLock {
  private constructor(
    readonly id: StateLockId,
    readonly operation: string | null,
    readonly asWritten: LockAsWritten,
    readonly lockedBy: PrincipalRef,
    readonly lockedAt: Date,
  ) {}

  static of(input: {
    id: StateLockId;
    operation: string | null;
    asWritten: LockAsWritten;
    lockedBy: PrincipalRef;
    lockedAt: Date;
  }): StateLock {
    return new StateLock(
      input.id,
      input.operation,
      { ...input.asWritten },
      input.lockedBy,
      input.lockedAt,
    );
  }

  heldAs(id: StateLockId | null): boolean {
    return id?.equals(this.id) ?? false;
  }

  heldBy(principal: PrincipalRef): boolean {
    return this.lockedBy.equals(principal);
  }

  sameAs(other: StateLock): boolean {
    return this.heldAs(other.id) && this.heldBy(other.lockedBy);
  }
}
