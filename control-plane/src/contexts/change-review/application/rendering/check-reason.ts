import type { SkipCode } from '@change-review/domain/value-objects/stack-check.vo';

const SAID: Readonly<Record<SkipCode, string>> = {
  'no-base':
    'Spotlight does not know where the run began, so nothing could be checked against it.',
  'no-checkout': 'Spotlight does not know which checkout the changes are from.',
  'checkout-failed':
    'Spotlight could not lay out a copy of the checkout to check.',
  'setup-failed': 'The checkout could not be made ready before the check ran.',
  'no-room': 'The runner had no room to check the layers.',
  'out-of-time': 'There was no time left to check the layers.',
  'nobody-checked': 'No runner checked the layers in time.',
};

export interface UncheckedFor {
  readonly skipped: { code: SkipCode; detail: string | null } | null;
  readonly wholeFailed: boolean;
}

export const checkReasonOf = (found: UncheckedFor): string | null => {
  if (found.skipped) {
    return [SAID[found.skipped.code], found.skipped.detail]
      .filter(Boolean)
      .join('\n\n');
  }

  return found.wholeFailed
    ? 'The finished change does not pass the check, so its layers were not checked on their own.'
    : null;
};
