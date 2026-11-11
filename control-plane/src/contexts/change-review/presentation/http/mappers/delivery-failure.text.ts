import type { DeliveryFailureDto } from '@change-review/application/dto/run-review.dto';
import type { DeliveryFailureCode } from '@change-review/domain/value-objects/delivery-failure.vo';

const UNREACHABLE = 'Spotlight couldn’t reach GitHub.';

const TEXT: Readonly<Record<DeliveryFailureCode, string>> = {
  'task-deleted': 'The task no longer exists.',
  'not-connected': 'The workspace isn’t connected to GitHub.',
  'parent-deleted': 'The comment that this reply answers no longer exists.',
  'parent-not-on-github':
    'The comment that this reply answers isn’t on GitHub yet.',
  'parent-never-on-github':
    'The comment that this reply answers was never posted to GitHub.',
  'never-on-github': 'The comment was never posted to GitHub.',
  'not-recorded':
    'Spotlight couldn’t save the comment that it posted to GitHub.',
  'github-unreachable': UNREACHABLE,
  'github-rejected': 'GitHub refused it.',
  unexpected: 'Spotlight couldn’t send it to GitHub.',
};

export const deliveryFailureText = (
  failure: DeliveryFailureDto | null,
): string | null => {
  if (!failure) {
    return null;
  }

  return failure.code === 'github-rejected'
    ? (failure.detail ?? TEXT[failure.code])
    : TEXT[failure.code];
};
