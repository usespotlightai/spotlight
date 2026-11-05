import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { ChangeStackVersionConflictError } from '@change-review/domain/exceptions/change-stack-version-conflict.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';

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
