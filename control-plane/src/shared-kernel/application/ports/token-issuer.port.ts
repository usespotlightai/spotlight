export const TOKEN_ISSUER = Symbol('TOKEN_ISSUER');

export interface NewToken {
  readonly token: string;
  readonly hash: string;
}

export interface TokenIssuer {
  issue(): NewToken;

  hash(token: string): string;
}
