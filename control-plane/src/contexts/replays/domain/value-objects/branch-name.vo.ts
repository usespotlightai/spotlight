import { InvalidConfigPullRequestError } from '@replays/domain/exceptions/invalid-config-pull-request.error';

export type BranchName = string & { readonly brand: 'branch-name' };

export const BranchName = {
  of(raw: string): BranchName {
    if (raw.length === 0 || /\s/.test(raw)) {
      throw new InvalidConfigPullRequestError(
        'branch must be non-empty without whitespace',
      );
    }

    return raw as BranchName;
  },
};
