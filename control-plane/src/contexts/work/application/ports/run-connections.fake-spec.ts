import type {
  ConnectionOfRun,
  RunConnectionsPort,
} from '@work/application/ports/run-connections.port';

export const connectionsInMemory = (
  recorded: readonly ConnectionOfRun[] = [],
): RunConnectionsPort => ({
  record: async () => {},
  of: async (runId) => recorded.filter((each) => each.runId === runId),
  wentWrongIn: async (runIds) =>
    recorded.filter(
      (each) => runIds.includes(each.runId) && each.connection.wentWrong,
    ),
  forgetBefore: async () => 0,
});
