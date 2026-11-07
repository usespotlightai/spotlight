import { InvalidConfigPullRequestError } from '@replays/domain/exceptions/invalid-config-pull-request.error';

export type ConfigPath = string & { readonly brand: 'config-path' };

export const ConfigPath = {
  of(raw: string): ConfigPath {
    if (raw.trim().length === 0) {
      throw new InvalidConfigPullRequestError('path must not be empty');
    }

    return raw as ConfigPath;
  },
};
