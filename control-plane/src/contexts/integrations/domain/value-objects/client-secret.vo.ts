import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';

export class ClientSecret implements Secret {
  get [SECRET](): true {
    return true;
  }

  private constructor(readonly value: string) {}

  static of(raw: string): ClientSecret {
    const token = raw.trim();

    if (token.length === 0) {
      throw new InvalidIdentifierError(
        'client secret',
        'is what the authorization server gave the client to prove itself with, and is never empty',
      );
    }

    return new ClientSecret(token);
  }

  static maybe(raw: string | null | undefined): ClientSecret | null {
    return raw?.trim() ? ClientSecret.of(raw) : null;
  }

  equals(other: ClientSecret): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return '[client secret]';
  }

  toJSON(): string {
    return '[client secret]';
  }
}
