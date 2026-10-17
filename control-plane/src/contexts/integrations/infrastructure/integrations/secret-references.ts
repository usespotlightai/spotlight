import {
  SECRET_REF,
  secretOf,
} from '@integrations/infrastructure/integrations/integration.schema';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export interface SecretReferenceAt {
  readonly path: FieldPath;
  readonly name: string;
}

type Fields = Readonly<Record<string, unknown>>;

const SPEC_KINDS = ['openapi', 'graphql', 'mcp'] as const;

const isRecord = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const entriesOf = (value: unknown): readonly [string, Fields][] =>
  isRecord(value)
    ? Object.entries(value).filter((entry): entry is [string, Fields] =>
        isRecord(entry[1]),
      )
    : [];

const itemsOf = (value: unknown): readonly [number, Fields][] =>
  Array.isArray(value)
    ? value
        .map((each, at): [number, unknown] => [at, each])
        .filter((entry): entry is [number, Fields] => isRecord(entry[1]))
    : [];

const reference = (value: unknown, path: FieldPath): SecretReferenceAt[] =>
  typeof value === 'string' && SECRET_REF.test(value)
    ? [{ path, name: secretOf(value) }]
    : [];

const references = (value: unknown, path: FieldPath): SecretReferenceAt[] =>
  Array.isArray(value)
    ? value.flatMap((each, at) => reference(each, path.to(at)))
    : [];

const inAuth = (auth: unknown, path: FieldPath): SecretReferenceAt[] => {
  if (!isRecord(auth)) {
    return [];
  }

  return [
    ...(isRecord(auth.hmac)
      ? reference(auth.hmac.secret, path.to('hmac', 'secret'))
      : []),
    ...(isRecord(auth.token)
      ? reference(auth.token.secret, path.to('token', 'secret'))
      : []),
    ...references(auth.secrets, path.to('secrets')),
  ];
};

const inRequest = (request: unknown, path: FieldPath): SecretReferenceAt[] =>
  isRecord(request) ? inAuth(request.auth, path.to('auth')) : [];

const inEvents = (events: unknown, path: FieldPath): SecretReferenceAt[] =>
  itemsOf(events).flatMap(([at, event]) => [
    ...(isRecord(event.lookup)
      ? inRequest(event.lookup.request, path.to(at, 'lookup', 'request'))
      : []),
    ...(isRecord(event.raise) && isRecord(event.raise.attachments)
      ? inRequest(
          event.raise.attachments.fetch,
          path.to(at, 'raise', 'attachments', 'fetch'),
        )
      : []),
  ]);

export const secretReferencesIn = (
  definition: Fields,
): readonly SecretReferenceAt[] => {
  const root = FieldPath.root();

  return [
    ...entriesOf(definition.actions).flatMap(([name, action]) =>
      inRequest(action.request, root.to('actions', name, 'request')),
    ),
    ...(isRecord(definition.webhook)
      ? [
          ...inAuth(definition.webhook.verify, root.to('webhook', 'verify')),
          ...inEvents(definition.webhook.events, root.to('webhook', 'events')),
        ]
      : []),
    ...(isRecord(definition.poll)
      ? [
          ...inRequest(definition.poll.request, root.to('poll', 'request')),
          ...inEvents(definition.poll.events, root.to('poll', 'events')),
        ]
      : []),
    ...SPEC_KINDS.flatMap((kind) =>
      isRecord(definition[kind])
        ? inAuth(definition[kind].auth, root.to(kind, 'auth'))
        : [],
    ),
    ...(isRecord(definition.connection) &&
    isRecord(definition.connection.manual)
      ? references(
          definition.connection.manual.secrets,
          root.to('connection', 'manual', 'secrets'),
        )
      : []),
  ];
};
