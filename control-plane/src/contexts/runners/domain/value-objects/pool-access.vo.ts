import type { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import { EgressTraffic } from '@runners/domain/value-objects/egress-traffic.vo';
import type { EncryptedProvisionSecret } from '@runners/domain/value-objects/encrypted-provision-secret.vo';
import type { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import type { RotationVersion } from '@runners/domain/value-objects/rotation-version.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

// How runners of a pool start: a host pulls them, or Spotlight asks a provisioner for them.
export type PoolMode = 'pull' | 'push';

export class PullAccess {
  readonly kind = 'pull' as const;

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
  readonly kind = 'push' as const;

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

// Spotlight adds the platform pool to each workspace. The deployment gives its provision URL and secret, so the access keeps neither.
export class PlatformAccess {
  readonly kind = 'platform' as const;

  readonly egressTraffic = EgressTraffic.all();

  // The operator of the deployment can disable the platform pool of one workspace. No other pool can be disabled.
  private constructor(
    readonly egress: EgressReference | null,
    readonly disabled: boolean,
  ) {}

  static of(egress: EgressReference | null, disabled = false): PlatformAccess {
    return new PlatformAccess(egress, disabled);
  }

  withDisabled(disabled: boolean): PlatformAccess {
    return new PlatformAccess(this.egress, disabled);
  }

  usesEgress(egress: EgressReference): boolean {
    return this.egress?.equals(egress) ?? false;
  }
}

export type PoolAccess = PullAccess | PushAccess | PlatformAccess;

// Hosts pull the runners of a pull pool. Spotlight asks a provisioner for the runners of the others.
export const modeOf = (access: PoolAccess): PoolMode =>
  access.kind === 'pull' ? 'pull' : 'push';
