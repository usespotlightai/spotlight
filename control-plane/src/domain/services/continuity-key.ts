/**
 * Names a task's stay at one station: what makes two runs the same continuing
 * work. Task and station together, so moving on starts afresh.
 */
export const ContinuityKey = {
  for({ taskId, stationId }: { taskId: string; stationId: string }): string {
    return `${taskId}-${stationId}`;
  },
};
