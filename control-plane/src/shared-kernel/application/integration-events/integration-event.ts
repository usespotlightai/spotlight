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

// An integration event kind is <context>.<name>.v<version>. A domain event kind has no version.
const INTEGRATION_EVENT_KIND = /^[a-z][a-z-]*\.[a-z][a-z-]*\.v\d+$/;

export const isIntegrationEventKind = (kind: string): boolean =>
  INTEGRATION_EVENT_KIND.test(kind);
