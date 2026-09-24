import type { CatalogKind } from '@catalog/domain/entities/catalog-item.entity';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface CatalogItemDto {
  readonly kind: CatalogKind;
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly constraint: string;
  readonly plan: string;
  readonly description: string;
  readonly tools: readonly string[];
}

export type CatalogResolution =
  | { readonly outcome: 'resolved'; readonly item: CatalogItemDto }
  | {
      readonly outcome: 'invalid';
      readonly problems: readonly ConfigurationProblem[];
    }
  | { readonly outcome: 'unmatched'; readonly because: string }
  | { readonly outcome: 'not-entitled'; readonly because: string };
