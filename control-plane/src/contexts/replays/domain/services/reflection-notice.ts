import type { FailureCause } from '@replays/domain/value-objects/failure-cause.vo';
import type { ReflectionResult } from '@replays/domain/value-objects/reflection-result';
import type { SearchIteration } from '@replays/domain/value-objects/search-iteration.vo';

export interface ReflectionNotice {
  readonly result: ReflectionResult;
  readonly endedSearch: boolean;
  readonly looked: number;
  readonly fixes: readonly FailureCause[];
}

export const reflectionNotice = (
  reflection: SearchIteration,
): ReflectionNotice | null => {
  const { result, endedSearch } = reflection;
  const fixes = reflection.causes.filter((each) => !each.configCanFix);

  return result && (endedSearch || fixes.length > 0)
    ? { result, endedSearch, looked: reflection.reflectedOn.length, fixes }
    : null;
};
