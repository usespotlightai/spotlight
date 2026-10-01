import type { ForgottenPort } from '@outcomes/application/ports/forgotten.port';

export const forgottenInMemory = (): ForgottenPort & {
  readonly holds: string[];
} => {
  const tasks = new Set<string>();
  const teams = new Set<string>();
  const workspaces = new Set<string>();
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
    },
    holding: async (workspaceId, taskId, teamId) => {
      holds.push(
        [workspaceId.value, teamId?.value, taskId?.value]
          .filter((each) => each !== undefined)
          .join(' '),
      );
    },
    forgot: async (workspaceId, taskId, teamId) =>
      workspaces.has(workspaceId.value) ||
      (taskId !== null && tasks.has(taskId.value)) ||
      (teamId !== undefined &&
        teamId !== null &&
        teams.has(`${workspaceId.value} ${teamId.value}`)),
  };
};
