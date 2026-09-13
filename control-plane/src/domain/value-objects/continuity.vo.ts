import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';
import type { HarnessSession } from '@domain/value-objects/harness-session.vo';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';

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
    const key = input.key.trim();

    if (key.length === 0) {
      throw new InvalidIdentifierError('continuity key');
    }

    return new Continuity(key, input.sessionId ?? null, input.pinnedTo ?? null);
  }

  equals(other: Continuity): boolean {
    return (
      this.key === other.key &&
      (this.sessionId === null
        ? other.sessionId === null
        : other.sessionId !== null && this.sessionId.equals(other.sessionId)) &&
      (this.pinnedTo === null
        ? other.pinnedTo === null
        : other.pinnedTo !== null && this.pinnedTo.equals(other.pinnedTo))
    );
  }

  told(): { key: string; sessionId?: string; keep: boolean } {
    return {
      key: this.key,
      ...(this.sessionId ? { sessionId: this.sessionId.value } : {}),
      keep: true,
    };
  }
}
