import type { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import type { RunnerName } from '@runners/domain/value-objects/runner-name.vo';
import type { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import type { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export const RUNNER_DEFINITIONS = Symbol('RUNNER_DEFINITIONS');

type Refused = {
  readonly ok: false;
  readonly problems: readonly ConfigurationProblem[];
};

export type CompiledRunner =
  | {
      readonly ok: true;
      readonly name: RunnerName;
      readonly labels: RunnerLabels;
      readonly token: string | null;
    }
  | Refused;

export type CompiledTrust =
  | {
      readonly ok: true;
      readonly key: TrustKey;
      readonly workload: TrustedWorkload;
      readonly labels: RunnerLabels;
    }
  | Refused;

export type CompiledWorkspaceRunners =
  | {
      readonly ok: true;
      readonly runners: readonly RunnerName[];
      readonly trusts: readonly TrustKey[];
    }
  | Refused;

export interface RunnerDefinitionsPort {
  runner(held: unknown): CompiledRunner;

  trust(held: unknown): CompiledTrust;

  workspaceRunners(held: unknown): CompiledWorkspaceRunners;
}
