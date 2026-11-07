export type NoticePostingAttempt =
  | { readonly kind: 'sent' }
  | { readonly kind: 'failed'; readonly answered: boolean };

export const postsAgainWithoutUploads = (
  attempt: NoticePostingAttempt,
  uploads: number,
): boolean => attempt.kind === 'failed' && attempt.answered && uploads > 0;
