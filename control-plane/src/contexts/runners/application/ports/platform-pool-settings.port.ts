import type { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import type { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import type { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import type { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';

// The provisioner that the deployment gives to every workspace. Spotlight reads it from the environment and does not store its URL or secret.
export interface PlatformPoolSettings {
  readonly url: ProvisionUrl;
  readonly secret: ProvisionSecret;
  readonly labels: RunnerLabels;
  readonly egress: EgressReference | null;
}
