import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export interface BoundSecretBinding {
  readonly host: string;
  readonly location: 'header' | 'query';
  readonly name: string;
  readonly sent: string;
}

export interface BoundSecret {
  readonly name: SecretName;
  readonly bindings: readonly BoundSecretBinding[];
  readonly awaitingValue: boolean;
  readonly entersSandbox: boolean;
}
