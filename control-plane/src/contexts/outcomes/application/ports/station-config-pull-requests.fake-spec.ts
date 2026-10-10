import type {
  StationConfigPullRequest,
  StationConfigPullRequestsPort,
} from '@outcomes/application/ports/station-config-pull-requests.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';

export const stationConfigPullRequestsInMemory =
  (): StationConfigPullRequestsPort & {
    readonly held: Map<string, StationConfigPullRequest>;
  } => {
    const held = new Map<string, StationConfigPullRequest>();

    return {
      held,
      note: async (pullRequest) => {
        if (!held.has(pullRequest.configPullRequestId)) {
          held.set(pullRequest.configPullRequestId, pullRequest);
        }
      },
      newestFor: async (station, fingerprints) => {
        const newest = new Map<string, StationConfigPullRequest>();

        for (const each of held.values()) {
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
        for (const [id, each] of [...held]) {
          if (
            each.workspaceId.equals(workspaceId) &&
            each.teamId.equals(teamId)
          ) {
            held.delete(id);
          }
        }
      },
      removeForWorkspace: async (workspaceId) => {
        for (const [id, each] of [...held]) {
          if (each.workspaceId.equals(workspaceId)) {
            held.delete(id);
          }
        }
      },
    };
  };
