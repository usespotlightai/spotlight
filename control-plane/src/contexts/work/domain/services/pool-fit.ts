import { HarnessRelease } from '@shared-kernel/domain/value-objects/harness-release.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';

export const poolCouldTake = (
  placement: RunnerPlacement,
  labels: RunnerTerms,
): boolean =>
  placement.clauses.every((clause) =>
    clause.some((each) => labels.has(each) || HarnessRelease.isTerm(each)),
  );
