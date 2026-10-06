import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface DescribedSourceDto {
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
  readonly source: string;
  readonly definition: Readonly<Record<string, unknown>>;
  readonly tools: Readonly<Record<string, string>>;
  readonly described: DescribedSourceDto | null;
  readonly warnings: readonly ConfigurationProblem[];
}
