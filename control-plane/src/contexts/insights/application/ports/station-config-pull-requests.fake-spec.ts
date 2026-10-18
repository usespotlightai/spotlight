import type {
  StationConfigPullRequest,
  StationConfigPullRequestsPort,
} from '@insights/application/ports/station-config-pull-requests.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';

export const stationConfigPullRequestsInMemory =
  (): StationConfigPullRequestsPort & {
    readonly stored: Map<string, StationConfigPullRequest>;
  } => {
    const stored = new Map<string, StationConfigPullRequest>();

    return {
      stored,
      note: async (pullRequest) => {
        if (!stored.has(pullRequest.configPullRequestId)) {
          stored.set(pullRequest.configPullRequestId, pullRequest);
        }
      },
      newestFor: async (station, fingerprints) => {
        const newest = new Map<string, StationConfigPullRequest>();

        for (const each of stored.values()) {
          const known = newest.get(each.fingerprint);

          if (
            each.workspaceId.equals(station.workspaceId) &&
            each.teamId.equals(station.teamId) &&
            each.stationId === station.stationId &&
            fingerprints.includes(each.fingerprint) &&
            (!known || each.openedAt > known.openedAt)
          ) {
            newest.set(each.fingerprint, each);
          }
        }

        return new Map<string, PullRequestUrl>(
          [...newest].map(([fingerprint, each]) => [fingerprint, each.url]),
        );
      },
      removeForTeam: async (workspaceId, teamId) => {
        for (const [id, each] of [...stored]) {
          if (
            each.workspaceId.equals(workspaceId) &&
            each.teamId.equals(teamId)
          ) {
            stored.delete(id);
          }
        }
      },
      removeForWorkspace: async (workspaceId) => {
        for (const [id, each] of [...stored]) {
          if (each.workspaceId.equals(workspaceId)) {
            stored.delete(id);
          }
        }
      },
    };
  };
