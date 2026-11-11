import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface LineResourceDto {
  readonly id: string;
  readonly version: number;
  readonly address: string;
  readonly teamId: string;
  readonly key: string;
  readonly definition: Readonly<Record<string, unknown>>;
  readonly warnings: readonly ConfigurationProblem[];
}
