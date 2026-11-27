import { firstOf } from '@shared-kernel/domain/item-at';

// The words of the notice that tells the admins of a workspace that the hosts of a pool or a trust are all offline.
export interface HostOutageWords {
  readonly headline: string;
  readonly points: readonly string[];
}

const sourceOf = (source: 'pool' | 'trust', key: string | null): string =>
  key === null ? `its ${source}` : `the ${source} ${key}`;

export const hostOutageWords = (outage: {
  readonly source: 'pool' | 'trust';
  readonly sourceKey: string | null;
  readonly hosts: readonly string[];
}): HostOutageWords => {
  const only = firstOf(outage.hosts);
  const of = sourceOf(outage.source, outage.sourceKey);

  return {
    headline:
      outage.hosts.length === 1 && only !== undefined
        ? `${only}, the only host of ${of}, is offline`
        : `All ${outage.hosts.length} hosts of ${of} are offline`,
    points: [
      'Queued chats and runs that need these hosts wait until one comes back.',
      'Start a host, or add another one. This notice resolves itself once a host reports in.',
    ],
  };
};
