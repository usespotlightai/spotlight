export const HOST_CONNECTED = 'integrations.host-connected.v1';

export type HostConnectedIntegrationEvent = {
  readonly kind: typeof HOST_CONNECTED;
  readonly teamId: string;
  readonly source: string;
  readonly handle: string | null;
};
