import type { Declaration } from '@work/domain/value-objects/declaration.vo';
import type { HarnessSession } from '@work/domain/value-objects/harness-session.vo';

export class HandoverReport {
  private constructor(
    readonly declared: Declaration | null,
    readonly session: HarnessSession | null,
  ) {}

  static of(input: {
    declared?: Declaration | null;
    session?: HarnessSession | null;
  }): HandoverReport {
    return new HandoverReport(input.declared ?? null, input.session ?? null);
  }

  static none(): HandoverReport {
    return new HandoverReport(null, null);
  }

  equals(other: HandoverReport): boolean {
    const same = <T extends { equals(o: T): boolean }>(
      a: T | null,
      b: T | null,
    ): boolean => (a === null || b === null ? a === b : a.equals(b));

    return (
      same(this.declared, other.declared) && same(this.session, other.session)
    );
  }
}
