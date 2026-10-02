import { DraftingError } from '@change-review/application/errors/drafting.error';
import type {
  ChangeStackDraft,
  ChangeStackDrafted,
  ChangeStackDrafterPort,
} from '@change-review/application/ports/change-stack-drafter.port';
import type { ModelCall } from '@shared-kernel/domain/value-objects/model-usage.vo';

export type DraftingAttempt =
  | { readonly drafted: true; readonly answer: ChangeStackDrafted }
  | {
      readonly drafted: false;
      readonly usage: ModelCall | null;
      readonly error: unknown;
    };

export const attemptDrafting = async (
  drafter: ChangeStackDrafterPort,
  draft: ChangeStackDraft,
): Promise<DraftingAttempt> => {
  try {
    return { drafted: true, answer: await drafter.draft(draft) };
  } catch (error) {
    return {
      drafted: false,
      usage: error instanceof DraftingError ? error.usage : null,
      error,
    };
  }
};
