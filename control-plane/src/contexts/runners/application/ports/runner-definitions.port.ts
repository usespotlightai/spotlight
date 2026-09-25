import type { MaxRuns } from '@runners/domain/value-objects/max-runs.vo';
import type { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import type { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import type { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import type { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import type { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import type { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export const RUNNER_DEFINITIONS = Symbol('RUNNER_DEFINITIONS');

type Refused = {
  readonly ok: false;
  readonly problems: readonly ConfigurationProblem[];
};

export type CompiledTrust =
  | {
      readonly ok: true;
      readonly key: TrustKey;
      readonly workload: TrustedWorkload;
      readonly labels: RunnerLabels;
    }
  | Refused;

export type CompiledPoolAccess =
  | {
      readonly mode: 'pull';
      readonly token: string | null;
      readonly tokenVersion: number | null;
    }
  | {
      readonly mode: 'push';
      readonly url: ProvisionUrl;
      readonly secret: ProvisionSecret | null;
      readonly secretVersion: number | null;
    };

export type CompiledPool =
  | {
      readonly ok: true;
      readonly key: PoolKey;
      readonly labels: RunnerLabels;
      readonly maxRuns: MaxRuns | null;
      readonly access: CompiledPoolAccess;
    }
  | Refused;

export type CompiledWorkspaceRunners =
  | {
      readonly ok: true;
      readonly trusts: readonly TrustKey[];
      readonly pools: readonly PoolKey[];
    }
  | Refused;

export interface RunnerDefinitionsPort {
  trust(held: unknown): CompiledTrust;

  pool(held: unknown): CompiledPool;

  workspaceRunners(held: unknown): CompiledWorkspaceRunners;
}
