export interface PullRequestMerge {
  readonly commit: string;
}

const COMMIT = /^[0-9a-f]{40}$/i;

export type ReportedMerge =
  | { readonly outcome: 'unmerged' }
  | { readonly outcome: 'merged'; readonly merge: PullRequestMerge }
  | { readonly outcome: 'unproven' };

export const mergeOf = (
  merged: boolean,
  commit: string | null,
): ReportedMerge => {
  if (!merged) {
    return { outcome: 'unmerged' };
  }

  return commit && COMMIT.test(commit)
    ? { outcome: 'merged', merge: { commit } }
    : { outcome: 'unproven' };
};
