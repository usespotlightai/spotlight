export const TOKEN_MINT = Symbol('TOKEN_MINT');

export interface MintedToken {
  readonly token: string;
  readonly hash: string;
}

export interface TokenMintPort {
  mint(): MintedToken;

  hash(token: string): string;
}
