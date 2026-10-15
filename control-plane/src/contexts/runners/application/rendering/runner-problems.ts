import type { InvalidRunnerPoolError } from '@runners/domain/exceptions/invalid-runner-pool.error';
import type { InvalidWorkspaceRunnersError } from '@runners/domain/exceptions/invalid-workspace-runners.error';
import type { PoolTokenSpentError } from '@runners/domain/exceptions/pool-token-spent.error';
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
    error:
      | RunnerPoolFixedError
      | PoolTokenTakenError
      | PoolTokenSpentError
      | InvalidRunnerPoolError,
  ): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: RUNNER_POOL,
      at: FieldPath.of(error.field.split('.')),
      reason: error.because,
    });
  },

  declarationRefused(
    error: InvalidWorkspaceRunnersError,
  ): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: WORKSPACE_RUNNERS,
      at: FieldPath.of([error.field, error.at]),
      reason: error.because,
    });
  },

  provisionedInTheClear(): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: RUNNER_POOL,
      at: FieldPath.of(['provision', 'url']),
      reason:
        'is not https. Its calls carry a one-run token. A production deployment refuses to make them',
      severity: 'warning',
    });
  },

  noSuchPool(key: string, at: number): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: WORKSPACE_RUNNERS,
      at: FieldPath.of(['pools', at]),
      reason: `names ${key}. Runner pool ${key} doesn't exist in this workspace`,
      severity: 'warning',
    });
  },

  noSuchTrust(key: string, at: number): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: WORKSPACE_RUNNERS,
      at: FieldPath.of(['trusts', at]),
      reason: `names ${key}. Runner trust ${key} doesn't exist in this workspace`,
      severity: 'warning',
    });
  },
};
