export const INTEGRATION_REDEFINED = 'integrations.integration-redefined.v1';

export type IntegrationRedefinedIntegrationEvent = {
  readonly kind: typeof INTEGRATION_REDEFINED;
  readonly integrationId: string;
  readonly teamId: string;
  readonly source: string;
  readonly offers: readonly string[];
};
