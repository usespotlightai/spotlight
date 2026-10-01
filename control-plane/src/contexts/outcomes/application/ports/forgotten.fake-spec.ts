import type { ForgottenPort } from '@outcomes/application/ports/forgotten.port';
import type { PullRequestTombstone } from '@outcomes/domain/services/pull-request-tombstone';

export const forgottenInMemory = (): ForgottenPort & {
  readonly holds: string[];
} => {
  const tasks = new Set<string>();
  const teams = new Set<string>();
  const workspaces = new Set<string>();
  const pullRequests = new Map<string, PullRequestTombstone>();
  const holds: string[] = [];

  return {
    holds,
    forgetTask: async (_workspaceId, taskId) => {
      tasks.add(taskId.value);
    },
    forgetTeam: async (workspaceId, teamId) => {
      teams.add(`${workspaceId.value} ${teamId.value}`);
    },
    forgetWorkspace: async (workspaceId) => {
      workspaces.add(workspaceId.value);

      for (const key of pullRequests.keys()) {
        if (key.startsWith(`${workspaceId.value} `)) {
          pullRequests.delete(key);
        }
      }
    },
    holding: async (workspaceId, taskId, teamId) => {
      holds.push(
        [workspaceId.value, teamId?.value, taskId?.value]
          .filter((each) => each !== undefined && each !== null)
          .join(' '),
      );
    },
    forgot: async (workspaceId, taskId, teamId) =>
      workspaces.has(workspaceId.value) ||
      (taskId !== null && tasks.has(taskId.value)) ||
      (teamId !== undefined &&
        teamId !== null &&
        teams.has(`${workspaceId.value} ${teamId.value}`)),
    holdingPullRequest: async (workspaceId, pullRequest) => {
      holds.push(`${workspaceId.value} ${pullRequest.value}`);
    },
    forgetPullRequest: async (workspaceId, pullRequest, tombstone) => {
      const key = `${workspaceId.value} ${pullRequest.value}`;
      const held = pullRequests.get(key);

      if (!held || held.updatedAt.getTime() < tombstone.updatedAt.getTime()) {
        pullRequests.set(key, tombstone);
      }
    },
    tombstoneOf: async (workspaceId, pullRequest) =>
      pullRequests.get(`${workspaceId.value} ${pullRequest.value}`) ?? null,
    dropTombstonesBefore: async (before, most) => {
      const dropped = [...pullRequests.entries()]
        .filter(([, each]) => each.updatedAt.getTime() < before.getTime())
        .slice(0, most);

      for (const [key] of dropped) {
        pullRequests.delete(key);
      }

      return dropped.length;
    },
  };
};
