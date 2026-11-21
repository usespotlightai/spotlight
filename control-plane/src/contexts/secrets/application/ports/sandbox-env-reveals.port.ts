import type {
  RevealedSandboxEnv,
  SandboxEnvRequest,
} from '@secrets/application/contracts/sandbox-env.contract';

export const SANDBOX_ENV_REVEALS = Symbol('SANDBOX_ENV_REVEALS');

export interface SandboxEnvRevealsPort {
  revealFor(request: SandboxEnvRequest): Promise<RevealedSandboxEnv>;
}
