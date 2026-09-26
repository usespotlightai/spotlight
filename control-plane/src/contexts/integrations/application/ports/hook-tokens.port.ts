export const HOOK_TOKENS = Symbol('HOOK_TOKENS');

export interface HookTokenClaims {
  readonly audience: string;
  readonly subject: string;
  readonly occurrence: string;
  readonly message: string;
  readonly bodyDigest: string;
}

export interface PublishedKeys {
  readonly keys: readonly Readonly<Record<string, unknown>>[];
}

export interface HookTokensPort {
  readonly signs: boolean;

  readonly issuer: string;

  signed(claims: HookTokenClaims): Promise<string>;

  keys(): Promise<PublishedKeys>;
}
