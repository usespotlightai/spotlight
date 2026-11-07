export const INTEGRATION_CONNECTION_STATUSES = [
  'not-required',
  'disconnected',
  'connected',
] as const;

export type IntegrationConnectionStatus =
  (typeof INTEGRATION_CONNECTION_STATUSES)[number];

export const connectionStatusOf = (
  requiresConnection: boolean,
  connected: boolean,
): IntegrationConnectionStatus => {
  if (!requiresConnection) {
    return 'not-required';
  }

  return connected ? 'connected' : 'disconnected';
};
