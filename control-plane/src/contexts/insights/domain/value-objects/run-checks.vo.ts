import { InvalidOutcomeError } from '@insights/domain/exceptions/invalid-outcome.error';
import {
  keepsOneStackEach,
  type RepositoryStack,
  withLatestStack,
} from '@insights/domain/services/repository-stacks';
import type { CheckVerdict } from '@insights/domain/value-objects/check-verdict';

export interface RepositoryCheck extends RepositoryStack {
  readonly verdict: CheckVerdict;
  readonly checkedAt: Date;
}

const isTime = (at: Date): boolean => !Number.isNaN(at.getTime());

const valid = (check: RepositoryCheck): RepositoryCheck => {
  if (!isTime(check.stackStartedAt) || !isTime(check.checkedAt)) {
    throw new InvalidOutcomeError(
      'must say when its stack started and was checked',
    );
  }

  return check;
};

const breaksTie = (check: RepositoryCheck, kept: RepositoryCheck): boolean =>
  kept.verdict === 'skipped' && check.verdict !== 'skipped';

export class RunChecks {
  static readonly NONE = new RunChecks([]);

  private constructor(readonly repositories: readonly RepositoryCheck[]) {}

  static of(repositories: readonly RepositoryCheck[]): RunChecks {
    if (!keepsOneStackEach(repositories)) {
      throw new InvalidOutcomeError('must keep one check for each repository');
    }

    return repositories.length === 0
      ? RunChecks.NONE
      : new RunChecks(repositories.map(valid));
  }

  checked(check: RepositoryCheck): RunChecks {
    const repositories = withLatestStack(
      this.repositories,
      valid(check),
      breaksTie,
    );

    return repositories === this.repositories
      ? this
      : new RunChecks(repositories);
  }

  get verdict(): CheckVerdict | null {
    const verdicts = this.repositories.map((each) => each.verdict);

    if (verdicts.length === 0) {
      return null;
    }
    if (verdicts.includes('failed')) {
      return 'failed';
    }

    return verdicts.includes('passed') ? 'passed' : 'skipped';
  }

  get checkedAt(): Date | null {
    return this.repositories.reduce<Date | null>(
      (latest, each) =>
        latest && latest.getTime() >= each.checkedAt.getTime()
          ? latest
          : each.checkedAt,
      null,
    );
  }
}
