import type { MessageBoxOptions } from 'electron';

const RELEASES =
  'https://github.com/usespotlightai/spotlight/releases/download';

export interface UpdateFeed {
  readonly provider: 'generic';
  readonly url: string;
  readonly channel: string;
}

export interface UpdateCheck {
  readonly isUpdateAvailable: boolean;
  readonly updateInfo: { readonly version: string };
}

export interface Updater {
  checkForUpdatesAndNotify(): Promise<UpdateCheck | null>;
}

export const updateFeedOf = (version: string): UpdateFeed | null => {
  const channel = /^\d+\.\d+\.\d+-([0-9A-Za-z-]+)/.exec(version)?.[1];

  return channel === undefined
    ? null
    : { provider: 'generic', url: `${RELEASES}/${channel}/`, channel };
};

export const updateCheckOutcome = async (
  updater: Updater,
  version: string,
): Promise<MessageBoxOptions> => {
  try {
    const result = await updater.checkForUpdatesAndNotify();

    if (result === null) {
      return {
        type: 'info',
        message: 'Updates are not available in this build.',
        detail: `Version ${version}`,
      };
    }

    if (result.isUpdateAvailable) {
      return {
        type: 'info',
        message: `Spotlight ${result.updateInfo.version} is downloading.`,
        detail: 'Spotlight installs it when you quit.',
      };
    }

    return {
      type: 'info',
      message: 'Spotlight is up to date.',
      detail: `Version ${version}`,
    };
  } catch (error) {
    return {
      type: 'warning',
      message: 'Spotlight could not check for updates.',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
};
