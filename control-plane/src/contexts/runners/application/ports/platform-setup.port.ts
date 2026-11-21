// What the deployment sets up for every workspace: the platform egress and the provisioner of the platform pool.
export interface PlatformSetup {
  readonly platformEgressSet: boolean;
  readonly platformPoolSet: boolean;
}
