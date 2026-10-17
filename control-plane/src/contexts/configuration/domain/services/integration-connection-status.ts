export const INTEGRATION_CONNECTION_STATUSES = [
  'listens',
  'unlinked',
  'linked',
] as const;

export type IntegrationConnectionStatus =
  (typeof INTEGRATION_CONNECTION_STATUSES)[number];

export const connectionStatusOf = (
  connectable: boolean,
  linked: boolean,
): IntegrationConnectionStatus => {
  if (!connectable) {
    return 'listens';
  }

  return linked ? 'linked' : 'unlinked';
};
