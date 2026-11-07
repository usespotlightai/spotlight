import type { PrincipalRef } from '@configuration/domain/value-objects/principal-ref.vo';
import { StateLockId } from '@configuration/domain/value-objects/state-lock-id.vo';

export type LockInfo = Readonly<Record<string, unknown>>;

export class StateLock {
  private constructor(
    readonly id: StateLockId,
    readonly info: LockInfo,
    readonly lockedBy: PrincipalRef,
    readonly lockedAt: Date,
  ) {}

  static of(input: {
    info: unknown;
    lockedBy: PrincipalRef;
    lockedAt: Date;
  }): StateLock {
    return new StateLock(
      StateLockId.in(input.info),
      input.info as LockInfo,
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
