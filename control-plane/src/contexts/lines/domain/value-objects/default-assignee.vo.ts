import { InvalidDefaultAssigneeError } from '@lines/domain/exceptions/invalid-default-assignee.error';

const SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const LONGEST = 254;

export class DefaultAssignee {
  private constructor(readonly email: string) {}

  static of(raw: string): DefaultAssignee {
    const email = raw.trim();

    if (email.length === 0) {
      throw new InvalidDefaultAssigneeError(
        'is the email of a team member, and it is empty',
      );
    }

    if (email.length > LONGEST || !SHAPE.test(email)) {
      throw new InvalidDefaultAssigneeError(
        `must be an email address, like ada@example.com, not "${email}"`,
      );
    }

    return new DefaultAssignee(email);
  }

  equals(other: DefaultAssignee): boolean {
    return this.email === other.email;
  }
}
