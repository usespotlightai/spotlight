import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export type SecretCarrier = 'harness-profile' | 'integration' | 'skill';

export interface CarriedSecret {
  readonly secret: SecretName;
  readonly carrier: SecretCarrier;
  readonly key: string;
}

export interface HookAtStation {
  readonly key: string;
  readonly integrations: readonly string[];
}

export interface StationDependsOn {
  readonly harnessProfile: string | null;
  readonly skills: readonly string[];
  readonly tools: readonly string[];
}

export interface DependencyFacts {
  readonly hooks: readonly HookAtStation[];
  readonly onMarksAsPlanned: readonly string[];
  readonly secrets: readonly CarriedSecret[];
}
