type Published =
  | string
  | number
  | boolean
  | null
  | readonly Published[]
  | { readonly [field: string]: Published };

// Integration events are a published language: the deployment event webhook sends them out of Spotlight. To change the payload of a kind, publish a new kind with the next version (.v2), and do not change the old one.
export type IntegrationEvent = {
  readonly kind: string;
  readonly [field: string]: Published;
};

// An integration event kind is <context>.<name>.v<version>, and the first group is the context that publishes it. A domain event kind has no version. The architecture tests use this pattern too.
export const INTEGRATION_EVENT_KIND = /^([a-z][a-z-]*)\.[a-z][a-z-]*\.v\d+$/;

export const isIntegrationEventKind = (kind: string): boolean =>
  INTEGRATION_EVENT_KIND.test(kind);
