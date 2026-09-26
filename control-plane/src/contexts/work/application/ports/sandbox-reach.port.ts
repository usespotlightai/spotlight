export const SANDBOX_REACH = Symbol('SANDBOX_REACH');

export interface SandboxReachPort {
  hosts(): readonly string[];
}
