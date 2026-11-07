export const takenUpOnAnswer = (
  runId: string,
  task: {
    readonly currentRunId: string | null;
    readonly awaitsPerson: boolean;
  },
): boolean => runId === task.currentRunId && !task.awaitsPerson;
