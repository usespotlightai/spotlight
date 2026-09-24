import type { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import type { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export type PoolMode = 'pull' | 'push';

export class PullAccess {
  readonly mode = 'pull' as const;

  private constructor(
    readonly tokenHash: TokenHash,
    readonly tokenVersion: number | null,
  ) {}

  static of(tokenHash: TokenHash, tokenVersion: number | null): PullAccess {
    return new PullAccess(tokenHash, tokenVersion);
  }

  rotatesOn(tokenVersion: number | null): boolean {
    return tokenVersion !== this.tokenVersion;
  }
}

export class PushAccess {
  readonly mode = 'push' as const;

  private constructor(
    readonly url: ProvisionUrl,
    readonly secret: ProvisionSecret | null,
    readonly secretVersion: number | null,
  ) {}

  static of(
    url: ProvisionUrl,
    secret: ProvisionSecret | null,
    secretVersion: number | null,
  ): PushAccess {
    return new PushAccess(url, secret, secretVersion);
  }

  rotatesOn(secretVersion: number | null): boolean {
    return secretVersion !== this.secretVersion;
  }
}

export type PoolAccess = PullAccess | PushAccess;
