import { distinct } from '@shared-kernel/domain/services/distinct';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { RepositorySetup } from '@work/domain/value-objects/repository-setup.vo';

export const chatPlacement = (
  repositories: readonly Repository[],
  lines: readonly Line[],
): RunnerPlacement | null => {
  const working = lines.filter((line) =>
    repositories.some((each) => line.names(each)),
  );
  const images = distinct(
    working.flatMap((line) => (line.image ? [line.image] : [])),
  );

  return images.length > 1
    ? null
    : RunnerPlacement.every(working.map((line) => line.runsIn));
};

export const chatSetupOf = (
  repository: Repository,
  lines: readonly Line[],
): RepositorySetup | null => {
  const setups = distinct(
    lines.flatMap((line) => {
      const setup = line.repositories.setupOf(repository);
      return setup ? [setup] : [];
    }),
  );

  return setups.length === 1 ? (setups[0] ?? null) : null;
};
