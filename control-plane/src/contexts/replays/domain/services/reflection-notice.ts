import type { ReflectionOutcome } from '@replays/domain/value-objects/reflection-outcome';
import type { SearchCause } from '@replays/domain/value-objects/search-cause.vo';
import type { SearchIteration } from '@replays/domain/value-objects/search-iteration.vo';

export interface ReflectionToTell {
  readonly outcome: ReflectionOutcome;
  readonly endedSearch: boolean;
  readonly looked: number;
  readonly fixes: readonly SearchCause[];
}

export const reflectionToTell = (
  reflection: SearchIteration,
): ReflectionToTell | null => {
  const { outcome, endedSearch } = reflection;
  const fixes = reflection.causes.filter((each) => !each.configCanFix);

  return outcome && (endedSearch || fixes.length > 0)
    ? { outcome, endedSearch, looked: reflection.reflectedOn.length, fixes }
    : null;
};
