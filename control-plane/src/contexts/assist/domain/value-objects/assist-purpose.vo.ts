import { InvalidAssistSessionError } from '@assist/domain/exceptions/invalid-assist-session.error';

const PURPOSE = /^[a-z][a-z-]*\.[a-z][a-z-]*$/;

/** What a session is for, named by the context that orders it: `<context>.<name>`, such as `insights.judge`. */
export class AssistPurpose {
  private readonly kind = 'assist-purpose';

  private constructor(readonly value: string) {}

  static of(value: string): AssistPurpose {
    if (!PURPOSE.test(value)) {
      throw new InvalidAssistSessionError(
        `needs a purpose named <context>.<name> in lowercase, not "${value}"`,
      );
    }

    return new AssistPurpose(value);
  }

  /** The context that orders sessions of this purpose: `insights` for `insights.judge`. */
  get context(): string {
    return this.value.slice(0, this.value.indexOf('.'));
  }

  equals(other: AssistPurpose): boolean {
    return other instanceof AssistPurpose && this.value === other.value;
  }
}
