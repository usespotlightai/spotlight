import type { EgressKey } from '@runners/domain/value-objects/egress-key.vo';
import type { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import type { EgressToken } from '@runners/domain/value-objects/egress-token.vo';
import type { EgressTraffic } from '@runners/domain/value-objects/egress-traffic.vo';
import type { EgressUrl } from '@runners/domain/value-objects/egress-url.vo';
import type { MaxRuns } from '@runners/domain/value-objects/max-runs.vo';
import type { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import type { PoolToken } from '@runners/domain/value-objects/pool-token.vo';
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

export type ParsedTrust =
  | {
      readonly ok: true;
      readonly key: TrustKey;
      readonly workload: TrustedWorkload;
      readonly labels: RunnerLabels;
    }
  | Refused;

export type ParsedPoolAccess =
  | {
      readonly mode: 'pull';
      readonly token: PoolToken | null;
      readonly tokenVersion: number | null;
    }
  | {
      readonly mode: 'push';
      readonly url: ProvisionUrl;
      readonly secret: ProvisionSecret | null;
      readonly secretVersion: number | null;
      readonly egress: EgressReference | null;
      readonly egressTraffic: EgressTraffic;
    };

export type ParsedPool =
  | {
      readonly ok: true;
      readonly key: PoolKey;
      readonly labels: RunnerLabels;
      readonly maxRuns: MaxRuns | null;
      readonly access: ParsedPoolAccess;
    }
  | Refused;

export type ParsedEgress =
  | {
      readonly ok: true;
      readonly key: EgressKey;
      readonly url: EgressUrl;
      readonly token: EgressToken | null;
      readonly tokenVersion: number | null;
    }
  | Refused;

export type ParsedWorkspaceRunners =
  | {
      readonly ok: true;
      readonly trusts: readonly TrustKey[];
      readonly pools: readonly PoolKey[];
    }
  | Refused;

export interface RunnerDefinitionsPort {
  trust(held: unknown): ParsedTrust;

  pool(held: unknown): ParsedPool;

  egress(held: unknown): ParsedEgress;

  workspaceRunners(held: unknown): ParsedWorkspaceRunners;
}
