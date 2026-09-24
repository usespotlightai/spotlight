import type {
  ExpressionAlsoSees,
  ExpressionReturns,
} from '@integrations/application/dto/expression-check.dto';
import { ExpressionPosition } from '@integrations/infrastructure/integrations/expression-position';
import {
  ACTING,
  ADDRESSING,
  answered,
  attaching,
  DEFAULTING,
  DELIVERED,
  LINKED,
  MARKING,
  POLLED,
  POLLING,
  requesting,
} from '@integrations/infrastructure/integrations/scopes';
import type { Scope } from '@platform/expressions/scope';
import {
  ANY_SEGMENT,
  FieldPath,
} from '@shared-kernel/domain/value-objects/field-path.vo';

const RESOURCE = 'integration';

interface Seeing {
  readonly returns?: ExpressionReturns;
  readonly alsoSees?: readonly ExpressionAlsoSees[];
}

const at = (name: string, scope: Scope, seeing: Seeing = {}) =>
  new ExpressionPosition(
    FieldPath.dotted(`${RESOURCE}.${name}`),
    scope,
    seeing.returns ?? null,
    seeing.alsoSees ?? [],
  );

const each = (
  prefix: string,
  fields: readonly string[],
  scope: Scope,
  alsoSees: readonly ExpressionAlsoSees[],
) => fields.map((field) => at(`${prefix}.${field}`, scope, { alsoSees }));

const authAt = (
  prefix: string,
  scope: Scope,
  alsoSees: readonly ExpressionAlsoSees[] = [],
) =>
  each(
    prefix,
    [
      'hmac.signed',
      'hmac.freshness.at',
      'basic.username',
      'basic.password',
      'asymmetric.key',
      'asymmetric.signed',
      'asymmetric.freshness.at',
    ],
    scope,
    alsoSees,
  );

const requestAt = (
  prefix: string,
  scope: Scope,
  alsoSees: readonly ExpressionAlsoSees[] = [],
) => [
  ...each(
    prefix,
    ['url', `query.${ANY_SEGMENT}`, `headers.${ANY_SEGMENT}`, 'body'],
    scope,
    alsoSees,
  ),
  ...authAt(`${prefix}.auth`, scope, alsoSees),
  at(`${prefix}.expect.success`, answered(scope), {
    returns: 'bool',
    alsoSees,
  }),
  at(`${prefix}.capture.${ANY_SEGMENT}`, answered(scope), { alsoSees }),
];

const raiseAt = (prefix: string, scope: Scope) => {
  const alsoSees: readonly ExpressionAlsoSees[] = ['item', 'captures'];
  const carried = attaching(scope);

  return [
    ...each(
      prefix,
      [
        'say',
        'opens.title',
        'opens.description',
        'opens.assignBy.email',
        'branch',
        `marks.${ANY_SEGMENT}.value`,
      ],
      scope,
      alsoSees,
    ),
    at(`${prefix}.attaches.each`, scope, { returns: 'list', alsoSees }),
    ...each(
      prefix,
      ['attaches.name', 'attaches.type', 'attaches.size'],
      carried,
      alsoSees,
    ),
    ...requestAt(`${prefix}.attaches.fetch`, requesting(carried), alsoSees),
  ];
};

const eventsAt = (prefix: string, trigger: Scope) => {
  const alsoSees: readonly ExpressionAlsoSees[] = ['item'];
  const looked = requesting(trigger);

  return [
    at(`${prefix}.forEach`, trigger, { returns: 'list' }),
    at(`${prefix}.when`, trigger, { returns: 'bool', alsoSees }),
    ...requestAt(`${prefix}.lookup.request`, looked, alsoSees),
    at(`${prefix}.lookup.capture.${ANY_SEGMENT}`, answered(looked), {
      alsoSees,
    }),
    ...raiseAt(`${prefix}.raise`, trigger),
  ];
};

export const EXPRESSION_POSITIONS: readonly ExpressionPosition[] = [
  ...authAt('webhook.verify', DELIVERED),
  at('webhook.respond.when', DELIVERED, { returns: 'bool' }),
  at('webhook.respond.body', DELIVERED),
  at('webhook.mine', DELIVERED, { returns: 'bool' }),
  at('webhook.route.by', DELIVERED),
  at('webhook.delivery', DELIVERED),
  ...eventsAt(`webhook.events.${ANY_SEGMENT}`, DELIVERED),
  ...requestAt('poll.request', POLLING),
  at('poll.cursor', POLLED),
  ...eventsAt(`poll.events.${ANY_SEGMENT}`, POLLED),
  ...requestAt(`actions.${ANY_SEGMENT}.request`, ACTING, ['inputs']),
  at(`tools.${ANY_SEGMENT}.inputs.${ANY_SEGMENT}.default`, DEFAULTING),
  at(
    `tools.${ANY_SEGMENT}.output`,
    answered(ACTING).and({ capture: 'map<string, dyn>' }),
    { alsoSees: ['inputs'] },
  ),
  at('connection.oauth2.identity', LINKED),
  at(`on.${ANY_SEGMENT}.to.${ANY_SEGMENT}`, ADDRESSING),
  at(`on.${ANY_SEGMENT}.mark.${ANY_SEGMENT}.value`, MARKING),
];

const POSITIONS: ReadonlyMap<string, ExpressionPosition> = new Map(
  EXPRESSION_POSITIONS.map((position) => [
    position.position.rendered,
    position,
  ]),
);

export const positionOf = (pattern: FieldPath): ExpressionPosition => {
  const position = POSITIONS.get(pattern.rendered);

  if (!position) {
    throw new Error(`No expression is written at ${pattern.rendered}`);
  }

  return position;
};

export const positionAt = (field: FieldPath): FieldPath =>
  FieldPath.of([RESOURCE, ...field.segments]);

export const definitionAt = (position: FieldPath): FieldPath | null => {
  const [resource, ...within] = position.segments;

  return resource === RESOURCE ? FieldPath.of(within) : null;
};
