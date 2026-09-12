import { InvalidEmailAddressError } from '@domain/exceptions/invalid-email-address.error';

const SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const LONGEST = 254;

export class EmailAddress {
  private constructor(readonly value: string) {}

  static of(raw: string): EmailAddress {
    const written = raw.trim().toLowerCase();

    if (written.length > LONGEST || !SHAPE.test(written)) {
      throw new InvalidEmailAddressError(raw.trim());
    }

    return new EmailAddress(written);
  }

  equals(other: EmailAddress): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
