import type { StackCheckDto } from '@change-review/application/dto/change-stack.dto';
import type { SkipCode } from '@change-review/domain/value-objects/stack-check.vo';

const SKIP_DESCRIPTION: Readonly<Record<SkipCode, string>> = {
  'no-base':
    'Spotlight doesn’t know the commit where the run began. The layers can’t be checked without it.',
  'no-checkout': 'Spotlight does not know which checkout the changes are from.',
  'checkout-failed':
    'Spotlight could not lay out a copy of the checkout to check.',
  'setup-failed': 'The setup of the checkout failed before the check ran.',
  'workspace-failed':
    'The runner could not open a workspace to check the layers.',
  'out-of-time': 'There was no time left to check the layers.',
  'no-image': 'The host couldn’t pull the runner image that the line names.',
  'queue-timeout': 'No runner checked the layers in time.',
  'provision-failed':
    'Spotlight couldn’t provision a runner to check the layers.',
};

export const checkReasonOf = (
  found: Pick<StackCheckDto, 'skip' | 'wholeFailed'>,
): string | null => {
  if (found.skip) {
    return [SKIP_DESCRIPTION[found.skip.code], found.skip.detail]
      .filter(Boolean)
      .join('\n\n');
  }

  return found.wholeFailed
    ? 'The finished change fails the check. Spotlight didn’t check its layers one by one.'
    : null;
};
