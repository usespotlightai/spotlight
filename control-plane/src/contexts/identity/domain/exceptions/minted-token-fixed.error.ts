export class MintedTokenFixedError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'description';

  readonly because = 'cannot change on a token minted through a trust';

  constructor(tokenName: string) {
    super(
      `Token ${tokenName} was minted through a trust. Its description cannot change.`,
    );
    this.name = 'MintedTokenFixedError';
  }
}
