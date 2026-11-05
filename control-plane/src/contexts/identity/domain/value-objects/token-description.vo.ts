import { InvalidWorkspaceTokenError } from '@identity/domain/exceptions/invalid-workspace-token.error';
import { trimmedWithin } from '@identity/domain/value-objects/trimmed-within';

const LONGEST = 255;

export class TokenDescription {
  private readonly kind = 'token-description';

  private constructor(readonly value: string) {}

  static of(raw: string): TokenDescription {
    return new TokenDescription(
      trimmedWithin(
        raw,
        LONGEST,
        (because) => new InvalidWorkspaceTokenError('description', because),
      ),
    );
  }

  equals(other: TokenDescription): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
