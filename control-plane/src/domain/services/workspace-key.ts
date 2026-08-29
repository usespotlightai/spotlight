/**
 * Names the directory a task's runs work in while it stands at one station.
 *
 * Task and station together, not the task alone: runs at the same station
 * share what the last one left, which is what resuming a conversation needs,
 * while a task moving on gets a clean directory and reaches the next station
 * through the remote and its notes. It also keeps the pin short-lived — a task
 * is tied to one runner for its stay at a station, not for its whole journey.
 */
export const WorkspaceKey = {
  for({ taskId, stationId }: { taskId: string; stationId: string }): string {
    return `${taskId}-${stationId}`;
  },
};
