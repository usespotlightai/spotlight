import type {
  ConnectionOfRun,
  RunConnectionsPort,
} from '@runs/application/ports/run-connections.port';

export const connectionsInMemory = (
  recorded: readonly ConnectionOfRun[] = [],
): RunConnectionsPort => ({
  record: async () => {},
  of: async (runId) => recorded.filter((each) => each.runId === runId),
  errorsIn: async (runIds) =>
    recorded.filter(
      (each) => runIds.includes(each.runId) && each.connection.isError,
    ),
  purgeBefore: async () => 0,
});
