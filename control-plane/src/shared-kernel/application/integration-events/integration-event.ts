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

// The parts of an event kind: a context or an aggregate, as in change-review, a name, as in task-opened, and the version of an integration event, as in .v1. The architecture tests build their kind patterns from them too.
export const KIND_PARTS = {
  context: '[a-z][a-z-]*',
  name: '[a-z][a-z-]*',
  version: '\\.v\\d+',
} as const;

// An integration event kind is <context>.<name>.v<version>, and the first group is the context that publishes it. A domain event kind has no version.
export const INTEGRATION_EVENT_KIND = new RegExp(
  `^(${KIND_PARTS.context})\\.${KIND_PARTS.name}${KIND_PARTS.version}$`,
);

export const isIntegrationEventKind = (kind: string): boolean =>
  INTEGRATION_EVENT_KIND.test(kind);

// A context prefix, as in identity., names the start of each integration event kind that the context publishes.
const CONTEXT_PREFIX = new RegExp(`^${KIND_PARTS.context}\\.$`);

export const isContextPrefix = (prefix: string): boolean =>
  CONTEXT_PREFIX.test(prefix);
