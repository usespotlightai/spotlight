import type { Handover } from '@work/domain/value-objects/handover.vo';
import type { HarnessSession } from '@work/domain/value-objects/harness-session.vo';

export class HandoverReport {
  private constructor(
    readonly handover: Handover | null,
    readonly session: HarnessSession | null,
    readonly lastWords: string | null,
  ) {}

  static of(input: {
    handover?: Handover | null;
    session?: HarnessSession | null;
    lastWords?: string | null;
  }): HandoverReport {
    return new HandoverReport(
      input.handover ?? null,
      input.session ?? null,
      input.lastWords?.trim() || null,
    );
  }

  static none(): HandoverReport {
    return new HandoverReport(null, null, null);
  }

  equals(other: HandoverReport): boolean {
    const same = <T extends { equals(o: T): boolean }>(
      a: T | null,
      b: T | null,
    ): boolean => (a === null || b === null ? a === b : a.equals(b));

    return (
      same(this.handover, other.handover) &&
      same(this.session, other.session) &&
      this.lastWords === other.lastWords
    );
  }
}
