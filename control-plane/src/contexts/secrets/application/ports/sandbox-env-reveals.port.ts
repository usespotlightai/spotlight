import type {
  RevealedSandboxEnv,
  SandboxEnvReveal,
} from '@secrets/application/contracts/sandbox-env.contract';

export const SANDBOX_ENV_REVEALS = Symbol('SANDBOX_ENV_REVEALS');

export interface SandboxEnvRevealsPort {
  reveal(request: SandboxEnvReveal): Promise<RevealedSandboxEnv>;
}
