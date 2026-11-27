export type CatalogDenialReason = 'unknown' | 'wrong-kind';

const CODES = {
  unknown: 'catalog_item_unknown',
  'wrong-kind': 'catalog_item_wrong_kind',
} as const satisfies Readonly<Record<CatalogDenialReason, string>>;

export class DeniedCatalogItem {
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

  get code(): (typeof CODES)[CatalogDenialReason] {
    return CODES[this.reason];
  }
}
