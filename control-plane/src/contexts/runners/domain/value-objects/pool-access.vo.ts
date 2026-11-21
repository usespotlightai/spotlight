import type { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import { EgressTraffic } from '@runners/domain/value-objects/egress-traffic.vo';
import type { EncryptedProvisionSecret } from '@runners/domain/value-objects/encrypted-provision-secret.vo';
import type { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import type { RotationVersion } from '@runners/domain/value-objects/rotation-version.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export type PoolMode = 'pull' | 'push';

export class PullAccess {
  readonly mode = 'pull' as const;

  private constructor(
    readonly tokenHash: TokenHash,
    readonly tokenVersion: RotationVersion,
  ) {}

  static of(tokenHash: TokenHash, tokenVersion: RotationVersion): PullAccess {
    return new PullAccess(tokenHash, tokenVersion);
  }

  rotatesOn(tokenVersion: RotationVersion): boolean {
    return this.tokenVersion.rotatesOn(tokenVersion);
  }
}

export class PushAccess {
  readonly mode = 'push' as const;

  private constructor(
    readonly url: ProvisionUrl,
    readonly secret: EncryptedProvisionSecret,
    readonly secretVersion: RotationVersion,
    readonly egress: EgressReference | null,
    readonly egressTraffic: EgressTraffic,
  ) {}

  static of(
    url: ProvisionUrl,
    secret: EncryptedProvisionSecret,
    secretVersion: RotationVersion,
    egress: EgressReference | null,
    egressTraffic: EgressTraffic = EgressTraffic.all(),
  ): PushAccess {
    return new PushAccess(
      url,
      secret,
      secretVersion,
      egress,
      egress ? egressTraffic : EgressTraffic.all(),
    );
  }

  rotatesOn(secretVersion: RotationVersion): boolean {
    return this.secretVersion.rotatesOn(secretVersion);
  }

  usesEgress(egress: EgressReference): boolean {
    return this.egress?.equals(egress) ?? false;
  }
}

// The deployment gives the provision URL and secret of a managed pool, so the access keeps neither.
export class ManagedAccess {
  readonly mode = 'push' as const;

  readonly egressTraffic = EgressTraffic.all();

  private constructor(
    readonly egress: EgressReference | null,
    readonly disabled: boolean,
  ) {}

  static of(egress: EgressReference | null, disabled: boolean): ManagedAccess {
    return new ManagedAccess(egress, disabled);
  }

  usesEgress(egress: EgressReference): boolean {
    return this.egress?.equals(egress) ?? false;
  }
}

export type PoolAccess = PullAccess | PushAccess | ManagedAccess;
