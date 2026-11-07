import type { HarnessSession } from '@work/domain/value-objects/harness-session.vo';

export class Resume {
  private constructor(readonly session: HarnessSession | null) {}

  static of(input: { session?: HarnessSession | null }): Resume {
    return new Resume(input.session ?? null);
  }

  equals(other: Resume): boolean {
    return this.session === null
      ? other.session === null
      : other.session !== null && this.session.equals(other.session);
  }
}
