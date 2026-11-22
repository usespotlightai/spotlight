import { InvalidAssistSessionError } from '@assist/domain/exceptions/invalid-assist-session.error';

export const MAX_ASSIST_SESSION_KEY_LENGTH = 255;

/** Names one session among those of a workspace and purpose: the same key is the same session. */
export class AssistSessionKey {
  private readonly kind = 'assist-session-key';

  private constructor(readonly value: string) {}

  static of(value: string): AssistSessionKey {
    if (
      value.trim().length === 0 ||
      value.length > MAX_ASSIST_SESSION_KEY_LENGTH
    ) {
      throw new InvalidAssistSessionError(
        `needs a key of 1 to ${MAX_ASSIST_SESSION_KEY_LENGTH} characters`,
      );
    }

    return new AssistSessionKey(value);
  }

  equals(other: AssistSessionKey): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
