export const INTEGRATION_CONNECTED = 'integrations.integration-connected.v1';

export type IntegrationConnectedIntegrationEvent = {
  readonly kind: typeof INTEGRATION_CONNECTED;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly integration: string;
  readonly personId: string | null;
  readonly at: string;
};
