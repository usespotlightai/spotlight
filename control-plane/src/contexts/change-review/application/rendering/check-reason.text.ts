import type { StackCheckDto } from '@change-review/application/dto/change-stack.dto';
import type { SkipCode } from '@change-review/domain/value-objects/stack-check.vo';

const SKIP_TEXT: Readonly<Record<SkipCode, string>> = {
  'no-base':
    'Spotlight doesn’t know the commit where the run began. The layers can’t be checked without it.',
  'no-checkout': 'Spotlight does not know which checkout the changes are from.',
  'checkout-failed':
    'Spotlight could not lay out a copy of the checkout to check.',
  'setup-failed': 'The setup of the checkout failed before the check ran.',
  'working-copy-failed':
    'The runner could not open a working copy to check the layers.',
  'out-of-time': 'There was no time left to check the layers.',
  'no-image': 'The host couldn’t pull the runner image that the line names.',
  'queue-timeout': 'No runner checked the layers in time.',
  'provision-failed':
    'Spotlight couldn’t provision a runner to check the layers.',
};

const WHOLE_FAILED_TEXT =
  'The finished change fails the check. Spotlight didn’t check its layers one by one.';

const detailText = (skip: NonNullable<StackCheckDto['skip']>): string | null =>
  skip.code === 'provision-failed' && skip.attempts !== null
    ? `Attempts: ${skip.attempts}\nLast failure: ${skip.detail ?? ''}`.trimEnd()
    : skip.detail;

export const checkReasonText = (
  check: Pick<StackCheckDto, 'skip' | 'wholeFailed'>,
): string | null => {
  if (check.skip) {
    return [SKIP_TEXT[check.skip.code], detailText(check.skip)]
      .filter(Boolean)
      .join('\n\n');
  }

  return check.wholeFailed ? WHOLE_FAILED_TEXT : null;
};
