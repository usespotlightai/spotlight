import type { HarnessSession } from '@runs/domain/value-objects/harness-session.vo';

export class Resume {
  private constructor(readonly sessionId: HarnessSession | null) {}

  static of(input: { sessionId?: HarnessSession | null }): Resume {
    return new Resume(input.sessionId ?? null);
  }

  equals(other: Resume): boolean {
    return this.sessionId === null
      ? other.sessionId === null
      : other.sessionId !== null && this.sessionId.equals(other.sessionId);
  }
}
