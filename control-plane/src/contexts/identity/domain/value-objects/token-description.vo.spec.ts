import { InvalidWorkspaceTokenError } from '@identity/domain/exceptions/invalid-workspace-token.error';
import { TokenDescription } from '@identity/domain/value-objects/token-description.vo';
import { describe, expect, it } from 'vitest';

describe('TokenDescription', () => {
  it('accepts exactly 255 characters and rejects one more', () => {
    expect(TokenDescription.of('a'.repeat(255)).value).toHaveLength(255);
    expect(() => TokenDescription.of('a'.repeat(256))).toThrow(
      new InvalidWorkspaceTokenError(
        'description',
        'must be at most 255 characters',
      ),
    );
  });
});
