export type NoticePostingAttempt =
  | { readonly kind: 'sent' }
  | { readonly kind: 'failed'; readonly answered: boolean };

export const postsAgainWithoutUploads = (
  attempt: NoticePostingAttempt,
  uploads: number,
): boolean => attempt.kind === 'failed' && attempt.answered && uploads > 0;

export type ReadinessFailure = 'check-again' | 'refused' | 'not-ready';

const REFUSING = new Set([401, 403]);

export const readinessFailureAfter = (
  status: number,
  attempt: number,
  attempts: number,
): ReadinessFailure => {
  if (REFUSING.has(status)) {
    return 'refused';
  }

  return attempt >= attempts ? 'not-ready' : 'check-again';
};
