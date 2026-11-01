import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export class CallSecretsClaim {
  private constructor(
    readonly tokenHash: TokenHash,
    readonly redeemedAt: Date | null,
  ) {}

  static issued(tokenHash: TokenHash): CallSecretsClaim {
    return new CallSecretsClaim(tokenHash, null);
  }

  static rehydrate(input: {
    tokenHash: TokenHash;
    redeemedAt: Date | null;
  }): CallSecretsClaim {
    return new CallSecretsClaim(input.tokenHash, input.redeemedAt);
  }

  get isRedeemed(): boolean {
    return this.redeemedAt !== null;
  }

  isRedeemedBy(tokenHash: TokenHash): boolean {
    return this.tokenHash.equals(tokenHash);
  }

  redeemed(at: Date): CallSecretsClaim {
    return new CallSecretsClaim(this.tokenHash, at);
  }
}
