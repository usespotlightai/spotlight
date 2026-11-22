import type {
  ChangeStackGenerationRequest,
  ChangeStackGeneratorPort,
} from '@change-review/application/ports/change-stack-generator.port';
import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import type { DraftedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

/**
 * Drafts the stack in an assist session and settles it with the draft. The stack decides what a failed session means
 * for it, and a draft that breaks the stack's rules is drafted again later, with its problems; the job waits while the
 * session runs.
 */
export const drafted = async (
  generator: ChangeStackGeneratorPort,
  stack: ChangeStack,
  request: ChangeStackGenerationRequest,
  settle: (
    drafting: ChangeStack,
    cohorts: readonly DraftedCohort[],
  ) => ChangeStack,
  now: Date,
  logger: LoggerPort,
): Promise<ChangeStack> => {
  const draft = await generator.generate(request);

  if (draft.status === 'waiting') {
    return stack.waitJob(now);
  }

  if (draft.status === 'failed') {
    logger.warn(
      {
        changeStackId: stack.id.value,
        state: stack.state,
        failure: draft.failure.reason,
      },
      'The session drafting a change stack gave no stack',
    );
    return stack.settleUndrafted(draft.failure, now);
  }

  const drafting = stack.recordModel(draft.usage);

  try {
    return settle(drafting, draft.cohorts);
  } catch (error) {
    if (!(error instanceof InvalidChangeStackError)) {
      throw error;
    }

    logger.warn(
      {
        changeStackId: stack.id.value,
        state: stack.state,
        problems: error.problems.map((each) => each.message),
      },
      'A drafted change stack broke its rules',
    );
    return drafting.retryForBrokenRules(error.problems, now);
  }
};
