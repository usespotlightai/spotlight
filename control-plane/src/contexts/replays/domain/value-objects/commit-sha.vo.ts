import { InvalidConfigPullRequestError } from '@replays/domain/exceptions/invalid-config-pull-request.error';

export type CommitSha = string & { readonly brand: 'commit-sha' };

export const CommitSha = {
  of(raw: string): CommitSha {
    if (raw.length === 0 || /\s/.test(raw)) {
      throw new InvalidConfigPullRequestError(
        'commit must be non-empty without whitespace',
      );
    }

    return raw as CommitSha;
  },
};
