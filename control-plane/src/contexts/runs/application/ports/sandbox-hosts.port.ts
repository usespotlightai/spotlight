export const SANDBOX_HOSTS = Symbol('SANDBOX_HOSTS');

export interface SandboxHostsPort {
  hosts(): readonly string[];
}
