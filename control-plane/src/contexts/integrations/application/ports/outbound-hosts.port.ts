export const OUTBOUND_HOSTS = Symbol('OUTBOUND_HOSTS');

export interface OutboundHostsPort {
  allows(host: string): boolean;
}
