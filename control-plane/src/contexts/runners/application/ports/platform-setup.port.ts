import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';

// What the deployment sets up for every workspace: the platform egress, the provisioner of the platform pool, and the images that pool runs (null: any image).
export interface PlatformSetup {
  readonly platformEgressSet: boolean;
  readonly platformPoolSet: boolean;
  readonly platformImages: readonly RunnerImage[] | null;
}
