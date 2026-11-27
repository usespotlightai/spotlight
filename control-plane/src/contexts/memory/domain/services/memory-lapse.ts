import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const inactiveOf = (
  ids: readonly MemoryId[],
  found: readonly Memory[],
  teamId: TeamId,
): readonly string[] =>
  ids.flatMap((id) => {
    const memory = found.find((each) => each.id.equals(id));

    return memory?.activeOn(teamId, null)
      ? []
      : [memory?.handle.value ?? id.value];
  });

export const whyMergeNoLongerApplies = (
  replaced: readonly MemoryId[],
  found: readonly Memory[],
  merged: MemoryId,
): string | null => {
  const changed = replaced.flatMap((id) => {
    const memory = found.find((each) => each.id.equals(id));

    return memory?.retirement?.supersededBy?.equals(merged)
      ? []
      : [memory?.handle.value ?? id.value];
  });

  return changed.length > 0
    ? `${changed.join(' and ')} changed before the merge was made, so the merge no longer applies.`
    : null;
};
