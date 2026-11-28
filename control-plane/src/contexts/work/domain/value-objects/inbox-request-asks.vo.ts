import { InvalidInboxRequestError } from '@work/domain/exceptions/invalid-inbox-request.error';

// How many questions an inbox request still puts to people, such as the
// disputed claims of a judge disagreement that nobody answered yet.
export class InboxRequestAsks {
  private constructor(readonly value: number) {}

  static readonly ONE = new InboxRequestAsks(1);

  static of(raw: number): InboxRequestAsks {
    if (!Number.isInteger(raw) || raw < 1) {
      throw new InvalidInboxRequestError(
        `asks must be a whole number of at least 1, not ${raw}`,
      );
    }

    return new InboxRequestAsks(raw);
  }

  equals(other: InboxRequestAsks): boolean {
    return this.value === other.value;
  }
}
