import type { PlatformPoolDefinition } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { PlatformPoolAllowances } from '@runners/domain/value-objects/pool-access.vo';
import type { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import type { SigningSecret } from '@shared-kernel/domain/value-objects/signing-secret.vo';

// The provisioner that the deployment gives to every workspace, and the labels and egress of the platform pool. Spotlight reads it from the environment and does not store its URL or secret.
export interface PlatformPoolSettings extends PlatformPoolDefinition {
  readonly url: ProvisionUrl;
  readonly secret: SigningSecret;
  // The images that the platform pool runs. Null: any image.
  readonly images: readonly RunnerImage[] | null;
  // The work that the platform pool of a new workspace takes from the start. An existing platform pool keeps what the operator chose.
  readonly allows: PlatformPoolAllowances;
}
