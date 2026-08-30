import { InvalidHarnessSessionError } from '@domain/exceptions/invalid-harness-session.error';

const MAX_LENGTH = 200;

/**
 * What a harness called a conversation. It is the harness's name for it, not
 * ours: the control plane carries it so a later run can ask for the same
 * conversation, and reads nothing into it beyond being something to hand back.
 */
export class HarnessSession {
  private constructor(readonly value: string) {}

  static of(raw: string): HarnessSession {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidHarnessSessionError('must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidHarnessSessionError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new HarnessSession(trimmed);
  }

  equals(other: HarnessSession): boolean {
    return this.value === other.value;
  }
}
