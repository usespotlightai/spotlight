import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface SecretResourceDto {
  readonly id: string;
  readonly version: number;
  readonly address: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly bindings: readonly {
    readonly host: string;
    readonly location: string;
    readonly name: string;
    readonly prefix: string;
  }[];
  readonly valueWoVersion: number | null;
  readonly rotatedAt: string;
  readonly warnings: readonly ConfigurationProblem[];
}
