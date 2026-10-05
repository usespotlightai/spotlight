import {
  SECRET_REF,
  secretOf,
} from '@integrations/infrastructure/integrations/integration.schema';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export interface WornSecretAt {
  readonly path: FieldPath;
  readonly name: string;
}

type Held = Readonly<Record<string, unknown>>;

const DESCRIBED_SOURCES = ['openapi', 'graphql', 'mcp'] as const;

const isHeld = (value: unknown): value is Held =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const entriesOf = (value: unknown): readonly [string, Held][] =>
  isHeld(value)
    ? Object.entries(value).filter((entry): entry is [string, Held] =>
        isHeld(entry[1]),
      )
    : [];

const itemsOf = (value: unknown): readonly [number, Held][] =>
  Array.isArray(value)
    ? value
        .map((each, at): [number, unknown] => [at, each])
        .filter((entry): entry is [number, Held] => isHeld(entry[1]))
    : [];

const reference = (value: unknown, path: FieldPath): WornSecretAt[] =>
  typeof value === 'string' && SECRET_REF.test(value)
    ? [{ path, name: secretOf(value) }]
    : [];

const references = (value: unknown, path: FieldPath): WornSecretAt[] =>
  Array.isArray(value)
    ? value.flatMap((each, at) => reference(each, path.to(at)))
    : [];

const inAuth = (auth: unknown, path: FieldPath): WornSecretAt[] => {
  if (!isHeld(auth)) {
    return [];
  }

  return [
    ...(isHeld(auth.hmac)
      ? reference(auth.hmac.secret, path.to('hmac', 'secret'))
      : []),
    ...(isHeld(auth.token)
      ? reference(auth.token.secret, path.to('token', 'secret'))
      : []),
    ...references(auth.secrets, path.to('secrets')),
  ];
};

const inRequest = (request: unknown, path: FieldPath): WornSecretAt[] =>
  isHeld(request) ? inAuth(request.auth, path.to('auth')) : [];

const inEvents = (events: unknown, path: FieldPath): WornSecretAt[] =>
  itemsOf(events).flatMap(([at, event]) => [
    ...(isHeld(event.lookup)
      ? inRequest(event.lookup.request, path.to(at, 'lookup', 'request'))
      : []),
    ...(isHeld(event.raise) && isHeld(event.raise.attaches)
      ? inRequest(
          event.raise.attaches.fetch,
          path.to(at, 'raise', 'attaches', 'fetch'),
        )
      : []),
  ]);

export const secretsWornBy = (definition: Held): readonly WornSecretAt[] => {
  const root = FieldPath.root();

  return [
    ...entriesOf(definition.actions).flatMap(([name, action]) =>
      inRequest(action.request, root.to('actions', name, 'request')),
    ),
    ...(isHeld(definition.webhook)
      ? [
          ...inAuth(definition.webhook.verify, root.to('webhook', 'verify')),
          ...inEvents(definition.webhook.events, root.to('webhook', 'events')),
        ]
      : []),
    ...(isHeld(definition.poll)
      ? [
          ...inRequest(definition.poll.request, root.to('poll', 'request')),
          ...inEvents(definition.poll.events, root.to('poll', 'events')),
        ]
      : []),
    ...DESCRIBED_SOURCES.flatMap((kind) =>
      isHeld(definition[kind])
        ? inAuth(definition[kind].auth, root.to(kind, 'auth'))
        : [],
    ),
    ...(isHeld(definition.connection) && isHeld(definition.connection.manual)
      ? references(
          definition.connection.manual.secrets,
          root.to('connection', 'manual', 'secrets'),
        )
      : []),
  ];
};
