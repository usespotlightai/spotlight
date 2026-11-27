import type {
  ConnectionOfRun,
  RunConnectionsPort,
} from '@runs/application/ports/run-connections.port';

export const connectionsInMemory = (
  recorded: readonly ConnectionOfRun[] = [],
): RunConnectionsPort => ({
  of: (runId) =>
    Promise.resolve(recorded.filter((each) => each.runId === runId)),
  errorsIn: (runIds) =>
    Promise.resolve(
      recorded.filter(
        (each) => runIds.includes(each.runId) && each.connection.error !== null,
      ),
    ),
});
