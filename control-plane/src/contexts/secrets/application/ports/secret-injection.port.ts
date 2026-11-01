import type { InjectedSecrets } from '@secrets/application/contracts/injected-secrets.contract';
import type { VerifyingSecret } from '@secrets/application/contracts/verifying-secret.contract';

export const SECRET_INJECTION = Symbol('SECRET_INJECTION');

export interface SpotlightRequest {
  readonly workspaceId: string;
  readonly secrets: readonly string[];
  readonly url: string;
}

export interface RunRequest extends SpotlightRequest {
  readonly runId: string;
  readonly attempt: number;
}

export interface VerifyingRequest {
  readonly workspaceId: string;
  readonly secret: string;
}

export interface RunGrant {
  readonly workspaceId: string;
  readonly runId: string;
  readonly attempt: number;
  readonly secrets: readonly string[];
}

export interface SecretInjectionPort {
  grant(grant: RunGrant): Promise<void>;

  forRun(request: RunRequest): Promise<InjectedSecrets>;

  forSpotlight(request: SpotlightRequest): Promise<InjectedSecrets>;

  standInsFor(request: SpotlightRequest): Promise<InjectedSecrets>;

  standInsForRun(request: RunRequest): Promise<InjectedSecrets>;

  forVerifying(request: VerifyingRequest): Promise<VerifyingSecret>;
}
