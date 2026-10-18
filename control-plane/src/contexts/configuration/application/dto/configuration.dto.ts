import {
  INTEGRATION_CONNECTION_STATUSES,
  type IntegrationConnectionStatus,
} from '@configuration/domain/services/integration-connection-status';

export const CONFIGURED_INTEGRATION_CONNECTION_STATUSES =
  INTEGRATION_CONNECTION_STATUSES;

export interface ApiSpecView {
  readonly kind: string;
  readonly tools: number;
  readonly readAt: string;
  readonly problem: string | null;
}
export const CONFIGURED_INTEGRATION_ACTS_AS = ['team', 'requester'] as const;

export interface IntegrationView {
  readonly integration: string;
  readonly name: string;
  readonly path: string;
  readonly connectionStatus: IntegrationConnectionStatus;
  readonly actsAs: (typeof CONFIGURED_INTEGRATION_ACTS_AS)[number];
  readonly linkedAccount: string | null;
  readonly spec: ApiSpecView | null;
}

export interface ConfigurationDto {
  readonly integrations: readonly IntegrationView[];
}
