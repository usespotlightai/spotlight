import type { EgressTokenAlreadyUsedError } from '@runners/domain/exceptions/egress-token-already-used.error';
import type { EgressTokenInUseError } from '@runners/domain/exceptions/egress-token-in-use.error';
import type { InvalidEgressError } from '@runners/domain/exceptions/invalid-egress.error';
import type { InvalidRunnerPoolError } from '@runners/domain/exceptions/invalid-runner-pool.error';
import type { InvalidWorkspaceRunnersError } from '@runners/domain/exceptions/invalid-workspace-runners.error';
import type { PoolTokenAlreadyUsedError } from '@runners/domain/exceptions/pool-token-already-used.error';
import type { PoolTokenInUseError } from '@runners/domain/exceptions/pool-token-in-use.error';
import type { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const RUNNER_TRUST = 'runner-trust';

export const RUNNER_POOL = 'runner-pool';

export const WORKSPACE_RUNNERS = 'workspace-runners';

export const EGRESS = 'egress';

export const RunnerProblems = {
  immutableField(error: ImmutableFieldError): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: RUNNER_TRUST,
      at: FieldPath.of([error.field]),
      reason: error.because,
    });
  },

  poolInvalid(
    error:
      | ImmutableFieldError
      | PoolTokenInUseError
      | PoolTokenAlreadyUsedError
      | InvalidRunnerPoolError,
  ): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: RUNNER_POOL,
      at: FieldPath.of(error.field.split('.')),
      reason: error.because,
    });
  },

  egressInvalid(
    error:
      | ImmutableFieldError
      | EgressTokenInUseError
      | EgressTokenAlreadyUsedError
      | InvalidEgressError,
  ): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: EGRESS,
      at: FieldPath.of(error.field.split('.')),
      reason: error.because,
    });
  },

  egressInTheClear(): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: EGRESS,
      at: FieldPath.of(['url']),
      reason:
        'is not https. Runners send their proxy credential to it. A production deployment does not provision runners that use it',
      severity: 'warning',
    });
  },

  declarationInvalid(
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
        'is not https. Its calls carry a one-run token. A production deployment does not make them',
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
