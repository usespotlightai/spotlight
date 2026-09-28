import type { Memory } from '@memory/domain/aggregates/memory.aggregate';

export const withoutSuperseded = (
  memories: readonly Memory[],
  successors: readonly Memory[] = [],
): Memory[] => {
  const superseded = new Set(
    [...memories, ...successors].flatMap((each) =>
      each.supersedes ? [each.supersedes.value] : [],
    ),
  );

  return memories.filter((each) => !superseded.has(each.id.value));
};
