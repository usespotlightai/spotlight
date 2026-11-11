import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';

export class RefreshToken implements Secret {
  get [SECRET](): true {
    return true;
  }

  private constructor(readonly value: string) {}

  static rehydrate(stored: string): RefreshToken {
    try {
      return RefreshToken.of(stored);
    } catch {
      throw new InconsistentStateError(
        'refresh token',
        'was stored in a shape it cannot take',
      );
    }
  }

  static of(raw: string): RefreshToken {
    const token = raw.trim();

    if (token.length === 0) {
      throw new InvalidIntegrationPartError(
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
