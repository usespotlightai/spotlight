import type { StackFailure } from '@change-review/domain/value-objects/stack-progress.vo';

const TEXT: Readonly<Record<StackFailure, string>> = {
  'not-generated': 'Spotlight couldn’t generate the change stack.',
  'too-large': 'The change is too large for one change stack.',
  'broke-rules': 'The generated stack did not assign every hunk in order.',
};

export const changeStackFailureText = (
  failure: StackFailure | null,
): string | null => (failure ? TEXT[failure] : null);
