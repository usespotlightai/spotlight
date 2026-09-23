import type { ConfigurationMove } from '@configuration/domain/services/configuration-move';

interface CarriedPullRequestDto {
  readonly url: string;
}

interface ConfiguredIntegrationDto {
  readonly source: string;
  readonly name: string;
  readonly path: string;
  readonly connectable: boolean;
  readonly connection: { readonly handle: string | null } | null;
}

export interface ConfigurationDto {
  readonly repository: string | null;
  readonly readsFrom: string | null;
  readonly movingTo: string | null;
  readonly sha: string | null;
  readonly integrations: readonly ConfiguredIntegrationDto[];
}

export const CONFIGURATION_MOVE_KINDS = [
  'carried',
  'adopted',
  'repointed',
] as const satisfies readonly ConfigurationMove['kind'][];

export type ConfigurationMoveDto =
  | { readonly kind: 'carried'; readonly pullRequest: CarriedPullRequestDto }
  | { readonly kind: Exclude<ConfigurationMove['kind'], 'carried'> };
