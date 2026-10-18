import type { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import type { ResumeKey } from '@work/domain/value-objects/resume-key.vo';

export class Resume {
  private constructor(
    readonly key: ResumeKey,
    readonly sessionId: HarnessSession | null,
  ) {}

  static of(input: {
    key: ResumeKey;
    sessionId?: HarnessSession | null;
  }): Resume {
    return new Resume(input.key, input.sessionId ?? null);
  }

  equals(other: Resume): boolean {
    return (
      this.key.equals(other.key) &&
      (this.sessionId === null
        ? other.sessionId === null
        : other.sessionId !== null && this.sessionId.equals(other.sessionId))
    );
  }
}
