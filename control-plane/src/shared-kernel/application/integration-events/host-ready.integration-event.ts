export const HOST_READY = 'runners.host-ready.v1';

export type HostReadyIntegrationEvent = {
  readonly kind: typeof HOST_READY;
  readonly workspaceId: string;
};
