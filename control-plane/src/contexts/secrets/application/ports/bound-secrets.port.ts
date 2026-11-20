import type { SecretLocation } from '@secrets/application/contracts/injected-secrets.contract';

export const BOUND_SECRETS = Symbol('BOUND_SECRETS');

interface BoundSecretBindingShape {
  readonly host: string;
  readonly location: SecretLocation;
  readonly name: string;
  readonly sent: string;
}

export interface BoundSecretShape {
  readonly name: string;
  readonly bindings: readonly BoundSecretBindingShape[];
  readonly awaitingValue: boolean;
}

export interface BoundSecretsPort {
  boundIn(
    workspaceId: string,
    names: readonly string[],
  ): Promise<readonly BoundSecretShape[]>;
}
