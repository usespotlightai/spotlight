import type { InvalidRunnerPoolError } from '@runners/domain/exceptions/invalid-runner-pool.error';
import type { PoolTokenTakenError } from '@runners/domain/exceptions/pool-token-taken.error';
import type { RunnerNameFixedError } from '@runners/domain/exceptions/runner-name-fixed.error';
import type { RunnerPoolFixedError } from '@runners/domain/exceptions/runner-pool-fixed.error';
import type { RunnerTokenSpentError } from '@runners/domain/exceptions/runner-token-spent.error';
import type { RunnerTokenTakenError } from '@runners/domain/exceptions/runner-token-taken.error';
import type { RunnerTrustKeyFixedError } from '@runners/domain/exceptions/runner-trust-key-fixed.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const RUNNER = 'runner';

export const RUNNER_TRUST = 'runner-trust';

export const RUNNER_POOL = 'runner-pool';

export const WORKSPACE_RUNNERS = 'workspace-runners';

export const RunnerProblems = {
  nameFixed(error: RunnerNameFixedError): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: RUNNER,
      at: FieldPath.of([error.field]),
      reason: error.because,
    });
  },

  tokenRefused(
    error: RunnerTokenTakenError | RunnerTokenSpentError,
  ): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: RUNNER,
      at: FieldPath.of([error.field]),
      reason: error.because,
    });
  },

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

  drifted(name: string): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: WORKSPACE_RUNNERS,
      at: FieldPath.of(['runners']),
      reason: `leaves out ${name}, which is enrolled all the same; add it here or delete it`,
      severity: 'warning',
    });
  },

  noSuchRunner(name: string, at: number): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: WORKSPACE_RUNNERS,
      at: FieldPath.of(['runners', at]),
      reason: `names ${name}, but no runner by that name is enrolled`,
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
