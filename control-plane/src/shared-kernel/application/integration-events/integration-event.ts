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

// The name of a context, as in change-review.
const CONTEXT = '[a-z][a-z-]*';

// An integration event kind is <context>.<name>.v<version>, and the first group is the context that publishes it. A domain event kind has no version. The architecture tests use this pattern too.
export const INTEGRATION_EVENT_KIND = new RegExp(
  `^(${CONTEXT})\\.[a-z][a-z-]*\\.v\\d+$`,
);

export const isIntegrationEventKind = (kind: string): boolean =>
  INTEGRATION_EVENT_KIND.test(kind);

// A context prefix, as in identity., names the start of each integration event kind that the context publishes.
const CONTEXT_PREFIX = new RegExp(`^${CONTEXT}\\.$`);

export const isContextPrefix = (prefix: string): boolean =>
  CONTEXT_PREFIX.test(prefix);
