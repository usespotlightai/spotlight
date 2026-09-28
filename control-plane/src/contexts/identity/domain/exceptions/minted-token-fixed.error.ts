export class MintedTokenFixedError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'description';

  readonly because =
    'is fixed for a token minted through a trust, since it is not configuration; change the trust, or revoke the token';

  constructor(tokenName: string) {
    super(
      `The ${tokenName} token was minted through a trust and is never described anew`,
    );
    this.name = 'MintedTokenFixedError';
  }
}
