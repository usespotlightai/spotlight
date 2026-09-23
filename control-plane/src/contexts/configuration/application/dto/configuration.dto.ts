import {
  INTEGRATION_STANDINGS,
  type IntegrationStanding,
} from '@configuration/domain/services/integration-standing';

export const CONFIGURED_INTEGRATION_STANDINGS = INTEGRATION_STANDINGS;

export interface ConfiguredIntegrationDto {
  readonly source: string;
  readonly name: string;
  readonly path: string;
  readonly standing: IntegrationStanding;
  readonly handle: string | null;
}

export interface ConfigurationDto {
  readonly integrations: readonly ConfiguredIntegrationDto[];
}
