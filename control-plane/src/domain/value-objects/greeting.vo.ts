import { EmptyRecipientError } from '@domain/exceptions/empty-recipient.error';

export class Greeting {
  private constructor(private readonly recipient: string) {}

  static for(recipient: string): Greeting {
    const trimmed = recipient.trim();
    if (trimmed.length === 0) {
      throw new EmptyRecipientError();
    }
    return new Greeting(trimmed);
  }

  get message(): string {
    return `Hello ${this.recipient}!`;
  }

  equals(other: Greeting): boolean {
    return this.recipient === other.recipient;
  }
}
