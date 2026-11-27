const RELEASES =
  'https://github.com/usespotlightai/spotlight/releases/download';

export interface UpdateFeed {
  readonly provider: 'generic';
  readonly url: string;
  readonly channel: string;
}

export const updateFeedOf = (version: string): UpdateFeed | null => {
  const channel = /^\d+\.\d+\.\d+-([0-9A-Za-z-]+)/.exec(version)?.[1];

  return channel === undefined
    ? null
    : { provider: 'generic', url: `${RELEASES}/${channel}/`, channel };
};
