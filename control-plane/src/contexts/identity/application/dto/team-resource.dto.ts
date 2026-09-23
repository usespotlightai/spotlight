import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface TeamResourceDto {
  readonly id: string;
  readonly version: number;
  readonly address: string;
  readonly workspaceId: string;
  readonly key: string;
  readonly name: string;
  readonly warnings: readonly ConfigurationProblem[];
}
