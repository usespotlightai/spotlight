import {
  INTEGRATION_CONNECTION_STATUSES,
  type IntegrationConnectionStatus,
} from '@configuration/domain/services/integration-connection-status';

export const CONFIGURED_INTEGRATION_CONNECTION_STATUSES =
  INTEGRATION_CONNECTION_STATUSES;

export interface DescriptionView {
  readonly kind: string;
  readonly tools: number;
  readonly readAt: string;
  readonly problem: string | null;
}
export const CONFIGURED_INTEGRATION_HOLDER_RULES = [
  'team',
  'requester',
] as const;

export interface IntegrationView {
  readonly source: string;
  readonly name: string;
  readonly path: string;
  readonly connectionStatus: IntegrationConnectionStatus;
  readonly holderRule: (typeof CONFIGURED_INTEGRATION_HOLDER_RULES)[number];
  readonly handle: string | null;
  readonly described: DescriptionView | null;
}

export interface ConfigurationDto {
  readonly integrations: readonly IntegrationView[];
}
