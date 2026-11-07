import type {
  ConfigPullRequestStation,
  StationConfigPullRequestsPort,
} from '@insights/application/ports/station-config-pull-requests.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';

export interface OpenedConfigPullRequest extends ConfigPullRequestStation {
  readonly configPullRequestId: string;
  readonly fingerprint: string;
  readonly url: PullRequestUrl;
  readonly openedAt: Date;
}

export const stationConfigPullRequestsInMemory =
  (): StationConfigPullRequestsPort & {
    readonly stored: Map<string, OpenedConfigPullRequest>;
    opened(pullRequest: OpenedConfigPullRequest): void;
  } => {
    const stored = new Map<string, OpenedConfigPullRequest>();

    return {
      stored,
      opened: (pullRequest) => {
        stored.set(pullRequest.configPullRequestId, pullRequest);
      },
      newestFor: async (station, fingerprints) => {
        const newest = new Map<string, OpenedConfigPullRequest>();

        for (const each of stored.values()) {
          const known = newest.get(each.fingerprint);

          if (
            each.workspaceId.equals(station.workspaceId) &&
            each.teamId.equals(station.teamId) &&
            each.stationId.equals(station.stationId) &&
            fingerprints.some((one) => one === each.fingerprint) &&
            (!known || each.openedAt > known.openedAt)
          ) {
            newest.set(each.fingerprint, each);
          }
        }

        return new Map<string, PullRequestUrl>(
          [...newest].map(([fingerprint, each]) => [fingerprint, each.url]),
        );
      },
    };
  };
