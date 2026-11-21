import type { PlatformPoolDefinition } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import type { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';

// The provisioner that the deployment gives to every workspace, and the labels and egress of the platform pool. Spotlight reads it from the environment and does not store its URL or secret.
export interface PlatformPoolSettings extends PlatformPoolDefinition {
  readonly url: ProvisionUrl;
  readonly secret: ProvisionSecret;
}
