export const SANDBOX_RETIREMENT = Symbol('SANDBOX_RETIREMENT');

export interface SandboxRetirementPort {
  retire(workspaceId: string, key: string): Promise<void>;
}
