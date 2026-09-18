import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import type { HarnessSession } from '@work/domain/value-objects/harness-session.vo';

export class Continuity {
  private constructor(
    readonly key: ContinuityKey,
    readonly sessionId: HarnessSession | null,
    readonly pinnedTo: RunnerId | null,
  ) {}

  static of(input: {
    key: ContinuityKey;
    sessionId?: HarnessSession | null;
    pinnedTo?: RunnerId | null;
  }): Continuity {
    return new Continuity(
      input.key,
      input.sessionId ?? null,
      input.pinnedTo ?? null,
    );
  }

  equals(other: Continuity): boolean {
    return (
      this.key.equals(other.key) &&
      (this.sessionId === null
        ? other.sessionId === null
        : other.sessionId !== null && this.sessionId.equals(other.sessionId)) &&
      (this.pinnedTo === null
        ? other.pinnedTo === null
        : other.pinnedTo !== null && this.pinnedTo.equals(other.pinnedTo))
    );
  }
}
