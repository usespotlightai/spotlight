import type { SkipCode } from '@change-review/domain/value-objects/stack-check.vo';

const SKIP_DESCRIPTION: Readonly<Record<SkipCode, string>> = {
  'no-base':
    'Spotlight doesn’t know the commit where the run began. The layers can’t be checked without it.',
  'no-checkout': 'Spotlight does not know which checkout the changes are from.',
  'checkout-failed':
    'Spotlight could not lay out a copy of the checkout to check.',
  'setup-failed': 'The setup of the checkout failed before the check ran.',
  'no-room': 'The runner had no room to check the layers.',
  'out-of-time': 'There was no time left to check the layers.',
  'no-image': 'The host couldn’t pull the runner image that the line names.',
  'nobody-checked': 'No runner checked the layers in time.',
  unprovisioned: 'Spotlight couldn’t provision a runner to check the layers.',
};

export interface UncheckedFor {
  readonly skipped: { code: SkipCode; detail: string | null } | null;
  readonly wholeFailed: boolean;
}

export const checkReasonOf = (found: UncheckedFor): string | null => {
  if (found.skipped) {
    return [SKIP_DESCRIPTION[found.skipped.code], found.skipped.detail]
      .filter(Boolean)
      .join('\n\n');
  }

  return found.wholeFailed
    ? 'The finished change fails the check. Spotlight didn’t check its layers one by one.'
    : null;
};
