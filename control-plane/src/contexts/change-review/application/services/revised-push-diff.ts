import type { PushDiff } from '@change-review/domain/aggregates/push-diff.aggregate';
import { PushDiffVersionConflictError } from '@change-review/domain/exceptions/push-diff-version-conflict.error';
import type { PushDiffRepository } from '@change-review/domain/repositories/push-diff.repository';
import type { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';

const ATTEMPTS = 3;

export const revisedPushDiff = async (
  diffs: PushDiffRepository,
  id: PushDiffId,
  change: (diff: PushDiff) => PushDiff | null,
): Promise<PushDiff | null> => {
  for (let attempt = 1; ; attempt++) {
    const found = await diffs.find(id);
    const changed = found ? change(found) : null;

    if (!changed || changed === found) {
      return null;
    }

    try {
      await diffs.save(changed);
      return changed;
    } catch (error) {
      if (
        !(error instanceof PushDiffVersionConflictError) ||
        attempt >= ATTEMPTS
      ) {
        throw error;
      }
    }
  }
};
