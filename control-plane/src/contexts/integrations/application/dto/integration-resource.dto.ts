import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface IntegrationResourceDto {
  readonly id: string;
  readonly version: number;
  readonly address: string;
  readonly teamId: string;
  readonly source: string;
  readonly definition: Readonly<Record<string, unknown>>;
  readonly tools: Readonly<Record<string, string>>;
  readonly warnings: readonly ConfigurationProblem[];
}
