export const HOST_OUTAGE_ENDED = 'runners.host-outage-ended.v1';

// A host of the pool or trust of the outage reports in again, or the pool or trust is gone.
export type HostOutageEndedIntegrationEvent = {
  readonly kind: typeof HOST_OUTAGE_ENDED;
  readonly outageId: string;
  readonly workspaceId: string;
  readonly source: 'pool' | 'trust';
  readonly sourceId: string;
};
