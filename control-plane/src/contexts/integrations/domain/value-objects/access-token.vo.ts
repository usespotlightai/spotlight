import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';

export class AccessToken implements Secret {
  get [SECRET](): true {
    return true;
  }

  private constructor(readonly value: string) {}

  static of(raw: string): AccessToken {
    const token = raw.trim();

    if (token.length === 0) {
      throw new InvalidIdentifierError(
        'access token',
        'is what a host granted to act with, and a host always grants one',
      );
    }

    return new AccessToken(token);
  }

  static maybe(raw: string | null | undefined): AccessToken | null {
    return raw?.trim() ? AccessToken.of(raw) : null;
  }

  equals(other: AccessToken): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return '[access token]';
  }

  toJSON(): string {
    return '[access token]';
  }
}
