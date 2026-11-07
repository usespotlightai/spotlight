import { distinct } from '@shared-kernel/domain/services/distinct';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

export const chatPlacement = (
  repositories: readonly Repository[],
  lines: readonly LineMap[],
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
  lines: readonly LineMap[],
): string | null => {
  const setups = [
    ...new Set(
      lines.flatMap((line) => {
        const setup = line.repositories.setupOf(repository);
        return setup ? [setup] : [];
      }),
    ),
  ];

  return setups.length === 1 ? (setups[0] ?? null) : null;
};
