export const INTEGRATION_RETIRED = 'integrations.integration-retired.v1';

export type IntegrationRetiredIntegrationEvent = {
  readonly kind: typeof INTEGRATION_RETIRED;
  readonly integrationId: string;
  readonly teamId: string;
  readonly source: string;
  readonly offers: readonly string[];
};
