import type { Handover } from '@runs/domain/value-objects/handover.vo';
import type { HarnessSession } from '@runs/domain/value-objects/harness-session.vo';
import type { CheckoutHead } from '@shared-kernel/domain/value-objects/checkout-head.vo';

export class HandoverReport {
  private constructor(
    readonly handover: Handover | null,
    readonly session: HarnessSession | null,
    readonly heads: readonly CheckoutHead[],
  ) {}

  static of(input: {
    handover?: Handover | null;
    session?: HarnessSession | null;
    heads?: readonly CheckoutHead[];
  }): HandoverReport {
    return new HandoverReport(
      input.handover ?? null,
      input.session ?? null,
      input.heads ?? [],
    );
  }

  static none(): HandoverReport {
    return new HandoverReport(null, null, []);
  }

  equals(other: HandoverReport): boolean {
    const same = <T extends { equals(o: T): boolean }>(
      a: T | null,
      b: T | null,
    ): boolean => (a === null || b === null ? a === b : a.equals(b));

    return (
      same(this.handover, other.handover) &&
      same(this.session, other.session) &&
      this.heads.length === other.heads.length &&
      this.heads.every((head, index) => {
        const theirs = other.heads[index];

        return theirs !== undefined && head.equals(theirs);
      })
    );
  }
}
