import { InvalidConfigPullRequestError } from '@replays/domain/exceptions/invalid-config-pull-request.error';

export type ConfigPath = string & { readonly brand: 'config-path' };

const isConfigPath = (raw: string): raw is ConfigPath => raw.trim().length > 0;

export const ConfigPath = {
  of(raw: string): ConfigPath {
    if (!isConfigPath(raw)) {
      throw new InvalidConfigPullRequestError('path must not be empty');
    }

    return raw;
  },
};
