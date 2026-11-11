import type { EgressEnforcement } from '@runs/application/contracts/run-journal.contract';
import { decoded } from '@runs/infrastructure/journal/journalled';

export const enforcementOf = (
  data: string | null | undefined,
): EgressEnforcement | null => {
  if (!data) {
    return null;
  }

  try {
    const parsed = JSON.parse(decoded(data)) as { enforced?: unknown };

    if (typeof parsed.enforced !== 'boolean') {
      return null;
    }

    return parsed.enforced ? 'enforced' : 'not-enforced';
  } catch {
    return null;
  }
};
