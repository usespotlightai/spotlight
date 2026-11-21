import type { Credential } from '@secrets/application/contracts/credential.contract';
import type { DeniedSecret } from '@secrets/application/contracts/run-secret-fetch.contract';

interface SandboxVariable {
  readonly variable: string;
  readonly secret: string;
}

export interface SandboxEnvRequest {
  readonly workspaceId: string;
  readonly runId: string;
  readonly variables: readonly SandboxVariable[];
}

export interface RevealedVariable {
  readonly name: string;
  readonly value: Credential;
}

export interface RevealedSandboxEnv {
  readonly variables: readonly RevealedVariable[];
  readonly denied: readonly DeniedSecret[];
}
