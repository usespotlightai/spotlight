export type Published = string | number | boolean | null | readonly Published[];

export type IntegrationEvent = {
  readonly kind: string;
  readonly [field: string]: Published;
};
