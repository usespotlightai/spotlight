import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface WorkspaceResourceDto {
  readonly id: string;
  readonly version: number;
  readonly address: string;
  readonly name: string;
  readonly slug: string;
  readonly warnings: readonly ConfigurationProblem[];
}
