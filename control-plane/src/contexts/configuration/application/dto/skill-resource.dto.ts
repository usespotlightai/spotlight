import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface SkillResourceDto {
  readonly id: string;
  readonly version: number;
  readonly address: string;
  readonly teamId: string;
  readonly key: string;
  readonly files: Readonly<Record<string, string>>;
  readonly description: string;
  readonly secrets: readonly {
    readonly name: string;
    readonly description: string;
  }[];
  readonly tools: readonly string[];
  readonly warnings: readonly ConfigurationProblem[];
}
