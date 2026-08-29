import type { HarnessSession } from '@domain/value-objects/harness-session.vo';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';

/** What a run inherits from the one before it. */
export class Continuity {
  private constructor(
    readonly key: string,
    readonly sessionId: HarnessSession | null,
    readonly pinnedTo: RunnerId | null,
  ) {}

  static of(input: {
    key: string;
    sessionId?: HarnessSession | null;
    pinnedTo?: RunnerId | null;
  }): Continuity {
    return new Continuity(
      input.key,
      input.sessionId ?? null,
      input.pinnedTo ?? null,
    );
  }

  told(): { key: string; sessionId?: string; keep: boolean } {
    return {
      key: this.key,
      ...(this.sessionId ? { sessionId: this.sessionId.value } : {}),
      // Always: the next run at this station is what it is left for.
      keep: true,
    };
  }
}
