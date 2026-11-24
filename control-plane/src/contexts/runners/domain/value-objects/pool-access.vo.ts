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
// The work that the operator allows the platform pool of one workspace.
export interface PlatformPoolAllowances {
  readonly allowsSecrets?: boolean;
  readonly allowsReviewWork?: boolean;
}

// What the operator changes on the platform pool of one workspace, in one step.
export interface PlatformPoolChange extends PlatformPoolAllowances {
  readonly enabled?: boolean;
}

export class PlatformAccess {
  readonly kind = 'platform' as const;

  readonly egressTraffic = EgressTraffic.all();

  // The operator of the deployment can disable the platform pool of one workspace. No other pool can be disabled.
  // The platform pool takes runs that inject secrets, and checks and diffs, only after the operator allows them for the workspace. The secrets of such runs go through the egress of the deployment, and pushes start checks and diffs with no person asking, so each is a choice for the workspace.
  private constructor(
    readonly egress: EgressReference | null,
    readonly disabled: boolean,
    readonly allowsSecrets: boolean,
    readonly allowsReviewWork: boolean,
  ) {}

  static of(
    egress: EgressReference | null,
    disabled = false,
    allows: PlatformPoolAllowances = {},
  ): PlatformAccess {
    return new PlatformAccess(
      egress,
      disabled,
      allows.allowsSecrets ?? false,
      allows.allowsReviewWork ?? false,
    );
  }

  withEgress(egress: EgressReference | null): PlatformAccess {
    return new PlatformAccess(
      egress,
      this.disabled,
      this.allowsSecrets,
      this.allowsReviewWork,
    );
  }

  // A field that the change does not give stays as it is.
  changed(change: PlatformPoolChange): PlatformAccess {
    return new PlatformAccess(
      this.egress,
      change.enabled === undefined ? this.disabled : !change.enabled,
      change.allowsSecrets ?? this.allowsSecrets,
      change.allowsReviewWork ?? this.allowsReviewWork,
    );
  }

  usesEgress(egress: EgressReference): boolean {
    return this.egress?.equals(egress) ?? false;
  }
}

export type PoolAccess = PullAccess | PushAccess | PlatformAccess;

// Hosts pull the runners of a pull pool. Spotlight asks a provisioner for the runners of the others.
export const modeOf = (access: PoolAccess): PoolMode =>
  access.kind === 'pull' ? 'pull' : 'push';
