export const OAUTH2_NONCES = Symbol('OAUTH2_NONCES');

export interface OAuth2NoncesPort {
  spend(nonce: string, until: Date, now: Date): Promise<boolean>;
}
