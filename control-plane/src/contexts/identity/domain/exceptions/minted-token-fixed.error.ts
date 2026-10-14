export class MintedTokenFixedError extends Error {
  readonly violation = 'invalid' as const;

  readonly field = 'description';

  readonly because = 'cannot change on a token Spotlight minted';

  constructor(tokenName: string) {
    super(
      `Token ${tokenName} was minted by Spotlight. Its description cannot change.`,
    );
    this.name = 'MintedTokenFixedError';
  }
}
