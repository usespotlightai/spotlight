import type { EgressEnforcement } from '@runs/application/contracts/run-journal.contract';
import { decoded } from '@runs/infrastructure/journal/journalled';
import { nonEmpty } from '@shared-kernel/domain/non-empty';

export const enforcementOf = (
  data: string | null | undefined,
): EgressEnforcement | null => {
  if (!nonEmpty(data)) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(decoded(data));

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('enforced' in parsed) ||
      typeof parsed.enforced !== 'boolean'
    ) {
      return null;
    }

    return parsed.enforced ? 'enforced' : 'not-enforced';
  } catch {
    return null;
  }
};
