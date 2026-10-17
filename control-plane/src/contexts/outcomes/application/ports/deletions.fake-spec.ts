import type { DeletionsPort } from '@outcomes/application/ports/deletions.port';
import type { PullRequestTombstone } from '@outcomes/domain/services/pull-request-tombstone';

export const deletionsInMemory = (): DeletionsPort & {
  readonly locks: string[];
} => {
  const tasks = new Set<string>();
  const teams = new Set<string>();
  const workspaces = new Set<string>();
  const pullRequests = new Map<string, PullRequestTombstone>();
  const locks: string[] = [];

  return {
    locks,
    deleteTask: async (_workspaceId, taskId) => {
      tasks.add(taskId.value);
    },
    deleteTeam: async (workspaceId, teamId) => {
      teams.add(`${workspaceId.value} ${teamId.value}`);
    },
    deleteWorkspace: async (workspaceId) => {
      workspaces.add(workspaceId.value);

      for (const key of pullRequests.keys()) {
        if (key.startsWith(`${workspaceId.value} `)) {
          pullRequests.delete(key);
        }
      }
    },
    lockDeletion: async (workspaceId, taskId, teamId) => {
      locks.push(
        [workspaceId.value, teamId?.value, taskId?.value]
          .filter((each) => each !== undefined && each !== null)
          .join(' '),
      );
    },
    isDeleted: async (workspaceId, taskId, teamId) =>
      workspaces.has(workspaceId.value) ||
      (taskId !== null && tasks.has(taskId.value)) ||
      (teamId !== undefined &&
        teamId !== null &&
        teams.has(`${workspaceId.value} ${teamId.value}`)),
    lockPullRequestDeletion: async (workspaceId, pullRequest) => {
      locks.push(`${workspaceId.value} ${pullRequest.value}`);
    },
    deletePullRequest: async (workspaceId, pullRequest, tombstone) => {
      const key = `${workspaceId.value} ${pullRequest.value}`;
      const existing = pullRequests.get(key);

      if (
        !existing ||
        existing.updatedAt.getTime() < tombstone.updatedAt.getTime()
      ) {
        pullRequests.set(key, tombstone);
      }
    },
    tombstoneOf: async (workspaceId, pullRequest) =>
      pullRequests.get(`${workspaceId.value} ${pullRequest.value}`) ?? null,
    purgeTombstonesBefore: async (before, max) => {
      const dropped = [...pullRequests.entries()]
        .filter(([, each]) => each.updatedAt.getTime() < before.getTime())
        .slice(0, max);

      for (const [key] of dropped) {
        pullRequests.delete(key);
      }

      return dropped.length;
    },
  };
};
