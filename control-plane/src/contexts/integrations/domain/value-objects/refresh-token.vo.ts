import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';

export class RefreshToken implements Secret {
  get [SECRET](): true {
    return true;
  }

  private constructor(readonly value: string) {}

  static of(raw: string): RefreshToken {
    const token = raw.trim();

    if (token.length === 0) {
      throw new InvalidIdentifierError(
        'refresh token',
        'is what the service gave to get a new access token with, and is never empty',
      );
    }

    return new RefreshToken(token);
  }

  static maybe(raw: string | null | undefined): RefreshToken | null {
    return raw?.trim() ? RefreshToken.of(raw) : null;
  }

  equals(other: RefreshToken): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return '[refresh token]';
  }

  toJSON(): string {
    return '[refresh token]';
  }
}
