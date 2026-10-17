import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface ApiSpecDto {
  readonly kind: string;
  readonly hash: string | null;
  readonly readAt: string;
  readonly problem: string | null;
  readonly tools: number;
}

export interface IntegrationResourceDto {
  readonly id: string;
  readonly version: number;
  readonly address: string;
  readonly teamId: string;
  readonly integration: string;
  readonly definition: Readonly<Record<string, unknown>>;
  readonly tools: Readonly<Record<string, string>>;
  readonly spec: ApiSpecDto | null;
  readonly warnings: readonly ConfigurationProblem[];
}
