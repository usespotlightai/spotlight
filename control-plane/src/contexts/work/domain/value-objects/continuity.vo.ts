import type { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import type { HarnessSession } from '@work/domain/value-objects/harness-session.vo';

export class Continuity {
  private constructor(
    readonly key: ContinuityKey,
    readonly sessionId: HarnessSession | null,
  ) {}

  static of(input: {
    key: ContinuityKey;
    sessionId?: HarnessSession | null;
  }): Continuity {
    return new Continuity(input.key, input.sessionId ?? null);
  }

  equals(other: Continuity): boolean {
    return (
      this.key.equals(other.key) &&
      (this.sessionId === null
        ? other.sessionId === null
        : other.sessionId !== null && this.sessionId.equals(other.sessionId))
    );
  }
}
