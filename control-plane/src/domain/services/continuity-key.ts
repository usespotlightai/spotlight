export const ContinuityKey = {
  for({ taskId, stationId }: { taskId: string; stationId: string }): string {
    return `${taskId}-${stationId}`;
  },
};
