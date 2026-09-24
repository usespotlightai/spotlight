import type { WornSecrets } from '@secrets/application/contracts/worn-secrets.contract';

export const SECRET_INJECTION = Symbol('SECRET_INJECTION');

export interface SpotlightRequest {
  readonly workspaceId: string;
  readonly secrets: readonly string[];
  readonly url: string;
}

export interface RunRequest extends SpotlightRequest {
  readonly runId: string;
}

export interface RunGrant {
  readonly workspaceId: string;
  readonly runId: string;
  readonly secrets: readonly string[];
}

export interface SecretInjectionPort {
  grant(grant: RunGrant): Promise<void>;

  forRun(request: RunRequest): Promise<WornSecrets>;

  forSpotlight(request: SpotlightRequest): Promise<WornSecrets>;
}
