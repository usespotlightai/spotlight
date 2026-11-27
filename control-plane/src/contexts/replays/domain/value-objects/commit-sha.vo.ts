import { InvalidConfigPullRequestError } from '@replays/domain/exceptions/invalid-config-pull-request.error';

export type CommitSha = string & { readonly brand: 'commit-sha' };

const isCommitSha = (raw: string): raw is CommitSha =>
  raw.length > 0 && !/\s/.test(raw);

export const CommitSha = {
  of(raw: string): CommitSha {
    if (!isCommitSha(raw)) {
      throw new InvalidConfigPullRequestError(
        'commit must be non-empty without whitespace',
      );
    }

    return raw;
  },
};
