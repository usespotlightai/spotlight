export const HOST_OUTAGE_BEGAN = 'runners.host-outage-began.v1';

// The hosts of a pull pool or a trust all stopped reporting in, while work that they could take waits, or for a few minutes. SourceKey: the key of the pool or trust. Hosts: the names of its hosts. Since: when Spotlight last heard from one of them.
export type HostOutageBeganIntegrationEvent = {
  readonly kind: typeof HOST_OUTAGE_BEGAN;
  readonly outageId: string;
  readonly workspaceId: string;
  readonly source: 'pool' | 'trust';
  readonly sourceId: string;
  readonly sourceKey: string | null;
  readonly hosts: readonly string[];
  readonly since: string;
};
