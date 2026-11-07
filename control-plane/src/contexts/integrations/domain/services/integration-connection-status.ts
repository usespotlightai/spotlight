export const INTEGRATION_CONNECTION_STATUSES = [
  'not-required',
  'disconnected',
  'connected',
] as const;

export type IntegrationConnectionStatus =
  (typeof INTEGRATION_CONNECTION_STATUSES)[number];

export interface ConnectionFacts {
  readonly refreshFailedAt: Date | null;
}

export const isUsableConnection = (connection: ConnectionFacts): boolean =>
  connection.refreshFailedAt === null;

export const connectionStatusOf = (
  requiresConnection: boolean,
  connection: ConnectionFacts | null,
): IntegrationConnectionStatus => {
  if (!requiresConnection) {
    return 'not-required';
  }

  return connection !== null && isUsableConnection(connection)
    ? 'connected'
    : 'disconnected';
};
