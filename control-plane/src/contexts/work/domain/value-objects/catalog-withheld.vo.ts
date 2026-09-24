export type WithheldReason =
  | 'unknown'
  | 'wrong-kind'
  | 'not-entitled'
  | 'lapsed';

const CODES: Readonly<Record<WithheldReason, string>> = {
  unknown: 'catalog_item_unknown',
  'wrong-kind': 'catalog_item_wrong_kind',
  'not-entitled': 'not_entitled',
  lapsed: 'entitlement_lapsed',
};

export class CatalogWithheld {
  private constructor(
    readonly id: string,
    readonly reason: WithheldReason,
    readonly because: string,
  ) {}

  static of(input: {
    id: string;
    reason: WithheldReason;
    because: string;
  }): CatalogWithheld {
    return new CatalogWithheld(input.id, input.reason, input.because);
  }

  get saying(): string {
    return `${CODES[this.reason]}: ${this.because}`;
  }
}
