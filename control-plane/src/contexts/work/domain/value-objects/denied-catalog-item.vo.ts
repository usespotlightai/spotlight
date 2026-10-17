import type { RefusalReason } from '@work/domain/value-objects/run-outcome.vo';

export type CatalogDenialReason =
  | 'unknown'
  | 'wrong-kind'
  | 'not-entitled'
  | 'lapsed';

const CODES: Readonly<Record<CatalogDenialReason, string>> = {
  unknown: 'catalog_item_unknown',
  'wrong-kind': 'catalog_item_wrong_kind',
  'not-entitled': 'not_entitled',
  lapsed: 'entitlement_lapsed',
};

export class DeniedCatalogItem implements RefusalReason {
  private constructor(
    readonly id: string,
    readonly reason: CatalogDenialReason,
    readonly because: string,
  ) {}

  static of(input: {
    id: string;
    reason: CatalogDenialReason;
    because: string;
  }): DeniedCatalogItem {
    return new DeniedCatalogItem(input.id, input.reason, input.because);
  }

  get description(): string {
    return `${CODES[this.reason]}: ${this.because}`;
  }
}
