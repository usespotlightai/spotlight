export const INTEGRATION_DEFINED = 'integrations.integration-defined.v1';

export type IntegrationDefinedIntegrationEvent = {
  readonly kind: typeof INTEGRATION_DEFINED;
  readonly integrationId: string;
  readonly teamId: string;
  readonly source: string;
  readonly offers: readonly string[];
};
