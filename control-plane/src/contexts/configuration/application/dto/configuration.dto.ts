import {
  INTEGRATION_STANDINGS,
  type IntegrationStanding,
} from '@configuration/domain/services/integration-standing';

export const CONFIGURED_INTEGRATION_STANDINGS = INTEGRATION_STANDINGS;

export interface DescriptionView {
  readonly kind: string;
  readonly tools: number;
  readonly readAt: string;
  readonly problem: string | null;
}
export const CONFIGURED_INTEGRATION_HOLDINGS = ['team', 'requester'] as const;

export interface IntegrationView {
  readonly source: string;
  readonly name: string;
  readonly path: string;
  readonly standing: IntegrationStanding;
  readonly holding: (typeof CONFIGURED_INTEGRATION_HOLDINGS)[number];
  readonly handle: string | null;
  readonly described: DescriptionView | null;
}

export interface ConfigurationDto {
  readonly integrations: readonly IntegrationView[];
}
