export const HOST_OUTAGES = Symbol('HOST_OUTAGES');

export interface HostOutageSource {
  readonly kind: 'pool' | 'trust';
  readonly id: string;
}

// The outages that Runners raised for the hosts of a pull pool or a trust.
export interface HostOutagesPort {
  // The id of the outage that holds now for the pool or trust, or null once none does.
  openOutageOf(source: HostOutageSource): Promise<string | null>;
}
