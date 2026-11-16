export const INTEGRATION_CONNECTION_STATUSES = [
  'not-required',
  'disconnected',
  'connected',
] as const;

export type IntegrationConnectionStatus =
  (typeof INTEGRATION_CONNECTION_STATUSES)[number];

export const CONNECTION_PROBLEMS = ['other-client', 'refresh-failed'] as const;

export type ConnectionProblem = (typeof CONNECTION_PROBLEMS)[number];

export interface ConnectionFacts {
  readonly refreshFailedAt: Date | null;
}

export interface TeamConnectionFacts extends ConnectionFacts {
  readonly client: string;
}

export const isUsableConnection = (connection: ConnectionFacts): boolean =>
  connection.refreshFailedAt === null;

export const connectionProblemOf = (
  requiresConnection: boolean,
  connection: TeamConnectionFacts | null,
  ownClient: string | null,
): ConnectionProblem | null => {
  if (!requiresConnection || connection === null) {
    return null;
  }

  if (ownClient !== null && connection.client !== ownClient) {
    return 'other-client';
  }

  return isUsableConnection(connection) ? null : 'refresh-failed';
};

export const connectionStatusOf = (
  requiresConnection: boolean,
  connection: TeamConnectionFacts | null,
  ownClient: string | null,
): IntegrationConnectionStatus => {
  if (!requiresConnection) {
    return 'not-required';
  }

  return connection !== null &&
    connectionProblemOf(true, connection, ownClient) === null
    ? 'connected'
    : 'disconnected';
};
