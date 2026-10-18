import { InvalidInboxRequestError } from '@work/domain/exceptions/invalid-inbox-request.error';

const MAX_ABOUT = 200;

export class InboxRequestSubject {
  private constructor(readonly value: string) {}

  static of(raw: string): InboxRequestSubject {
    const about = raw.trim();

    if (!about || about.length > MAX_ABOUT) {
      throw new InvalidInboxRequestError(
        `subject must be 1 to ${MAX_ABOUT} characters`,
      );
    }

    return new InboxRequestSubject(about);
  }

  equals(other: InboxRequestSubject): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
