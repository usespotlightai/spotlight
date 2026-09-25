import type { InvalidRunnerPoolError } from '@runners/domain/exceptions/invalid-runner-pool.error';
import type { PoolTokenTakenError } from '@runners/domain/exceptions/pool-token-taken.error';
import type { RunnerPoolFixedError } from '@runners/domain/exceptions/runner-pool-fixed.error';
import type { RunnerTrustKeyFixedError } from '@runners/domain/exceptions/runner-trust-key-fixed.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const RUNNER_TRUST = 'runner-trust';

export const RUNNER_POOL = 'runner-pool';

export const WORKSPACE_RUNNERS = 'workspace-runners';

export const RunnerProblems = {
  keyFixed(error: RunnerTrustKeyFixedError): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: RUNNER_TRUST,
      at: FieldPath.of([error.field]),
      reason: error.because,
    });
  },

  poolRefused(
    error: RunnerPoolFixedError | PoolTokenTakenError | InvalidRunnerPoolError,
  ): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: RUNNER_POOL,
      at: FieldPath.of(error.field.split('.')),
      reason: error.because,
    });
  },

  provisionedInTheClear(): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: RUNNER_POOL,
      at: FieldPath.of(['provision', 'url']),
      reason:
        'is not https; its calls carry a one-run token, so a production deployment refuses to make them',
      severity: 'warning',
    });
  },

  noSuchPool(key: string, at: number): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: WORKSPACE_RUNNERS,
      at: FieldPath.of(['pools', at]),
      reason: `names ${key}, but the workspace has no runner pool by that key`,
      severity: 'warning',
    });
  },

  noSuchTrust(key: string, at: number): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: WORKSPACE_RUNNERS,
      at: FieldPath.of(['trusts', at]),
      reason: `names ${key}, but the workspace trusts no workload by that key`,
      severity: 'warning',
    });
  },
};
