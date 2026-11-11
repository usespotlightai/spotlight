export const HOST_BECAME_READY = 'runners.host-became-ready.v1';

export type HostBecameReadyIntegrationEvent = {
  readonly kind: typeof HOST_BECAME_READY;
  readonly workspaceId: string;
};
