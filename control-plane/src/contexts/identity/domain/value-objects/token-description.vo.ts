import { InvalidWorkspaceTokenError } from '@identity/domain/exceptions/invalid-workspace-token.error';

const LONGEST = 255;

export class TokenDescription {
  private readonly kind = 'token-description';

  private constructor(readonly value: string) {}

  static of(raw: string): TokenDescription {
    const trimmed = raw.trim();

    if (trimmed.length > LONGEST) {
      throw new InvalidWorkspaceTokenError(
        'description',
        `must be at most ${LONGEST} characters`,
      );
    }

    return new TokenDescription(trimmed);
  }

  equals(other: TokenDescription): boolean {
    return this.kind === other.kind && this.value === other.value;
  }
}
