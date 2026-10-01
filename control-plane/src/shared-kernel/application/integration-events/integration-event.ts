type Published =
  | string
  | number
  | boolean
  | null
  | readonly Published[]
  | { readonly [field: string]: Published };

export type IntegrationEvent = {
  readonly kind: string;
  readonly [field: string]: Published;
};
