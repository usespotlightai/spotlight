import { GenerationError } from '@change-review/application/errors/generation.error';
import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { ChangeStackVersionConflictError } from '@change-review/domain/exceptions/change-stack-version-conflict.error';
import type { StackProblem } from '@change-review/domain/exceptions/invalid-change-stack.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { ModelCall } from '@shared-kernel/domain/value-objects/model-usage.vo';

export const ATTEMPTS = 2;

export type GenerationAttempt<T> =
  | { readonly generated: true; readonly answer: T }
  | {
      readonly generated: false;
      readonly usage: ModelCall | null;
      readonly truncated: boolean;
      readonly error: unknown;
    };

export const attempted = async <T>(
  call: () => Promise<T>,
): Promise<GenerationAttempt<T>> => {
  try {
    return { generated: true, answer: await call() };
  } catch (error) {
    const failed = error instanceof GenerationError ? error : null;

    return {
      generated: false,
      usage: failed?.usage ?? null,
      truncated: failed?.truncated ?? false,
      error,
    };
  }
};

export const settleUnanswered = (
  stack: ChangeStack,
  failure: { readonly truncated: boolean; readonly error: unknown },
  now: Date,
  logger: LoggerPort,
): ChangeStack => {
  const about = {
    changeStackId: stack.id.value,
    state: stack.state,
    err: failure.error,
  };

  if (failure.truncated) {
    logger.warn(about, 'A change stack answer ran out of output tokens');
  } else {
    logger.error(about, 'A change stack model call failed');
  }

  return stack.settleFailedCall(failure, now);
};

export const withRenewedLease = async (
  stacks: ChangeStackRepository,
  stack: ChangeStack,
  now: Date,
): Promise<ChangeStack> => {
  await stacks.save(stack.renewJobLease(now));
  const renewed = await stacks.find(stack.id);

  if (!renewed) {
    throw new ChangeStackVersionConflictError(stack.id.value);
  }

  return renewed;
};

export const settleBroken = (
  stack: ChangeStack,
  problems: readonly StackProblem[],
  now: Date,
  logger: LoggerPort,
): ChangeStack => {
  logger.warn(
    {
      changeStackId: stack.id.value,
      state: stack.state,
      problems: problems.map((each) => each.message),
    },
    'A drafted change stack kept breaking its rules',
  );
  return stack.stopForBrokenRules(now);
};
