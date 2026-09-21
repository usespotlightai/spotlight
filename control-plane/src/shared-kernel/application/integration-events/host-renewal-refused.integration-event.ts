export const HOST_RENEWAL_REFUSED = 'integrations.host-renewal-refused.v1';

export type HostRenewalRefusedIntegrationEvent = {
  readonly kind: typeof HOST_RENEWAL_REFUSED;
  readonly teamId: string;
  readonly source: string;
  readonly refusedAt: string;
};
