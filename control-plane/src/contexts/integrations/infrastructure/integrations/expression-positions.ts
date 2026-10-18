import type {
  ExpressionAddedVariable,
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
} from '@integrations/infrastructure/integrations/scopes';
import type { Scope } from '@platform/expressions/scope';
import {
  ANY_SEGMENT,
  FieldPath,
} from '@shared-kernel/domain/value-objects/field-path.vo';

const RESOURCE = 'integration';

interface PositionVariables {
  readonly returns?: ExpressionReturns;
  readonly addedVariables?: readonly ExpressionAddedVariable[];
}

const at = (name: string, scope: Scope, variables: PositionVariables = {}) =>
  new ExpressionPosition(
    FieldPath.dotted(`${RESOURCE}.${name}`),
    scope,
    variables.returns ?? null,
    variables.addedVariables ?? [],
  );

const each = (
  prefix: string,
  fields: readonly string[],
  scope: Scope,
  addedVariables: readonly ExpressionAddedVariable[],
) => fields.map((field) => at(`${prefix}.${field}`, scope, { addedVariables }));

const verifyAt = (prefix: string, scope: Scope) =>
  each(
    prefix,
    [
      'hmac.signed',
      'hmac.freshness.at',
      'asymmetric.key',
      'asymmetric.signed',
      'asymmetric.freshness.at',
    ],
    scope,
    [],
  );

const requestAt = (
  prefix: string,
  scope: Scope,
  addedVariables: readonly ExpressionAddedVariable[] = [],
) => [
  ...each(
    prefix,
    ['url', `query.${ANY_SEGMENT}`, `headers.${ANY_SEGMENT}`, 'body'],
    scope,
    addedVariables,
  ),
  at(`${prefix}.expect.success`, answered(scope), {
    returns: 'bool',
    addedVariables,
  }),
  at(`${prefix}.capture.${ANY_SEGMENT}`, answered(scope), { addedVariables }),
];

const raiseAt = (prefix: string, scope: Scope) => {
  const addedVariables: readonly ExpressionAddedVariable[] = [
    'item',
    'captures',
  ];
  const carried = attaching(scope);

  return [
    ...each(
      prefix,
      [
        'message',
        'opens.title',
        'opens.description',
        'opens.assignBy.email',
        'branch',
        `marks.${ANY_SEGMENT}.value`,
      ],
      scope,
      addedVariables,
    ),
    at(`${prefix}.attachments.each`, scope, {
      returns: 'list',
      addedVariables,
    }),
    ...each(
      prefix,
      ['attachments.name', 'attachments.type', 'attachments.size'],
      carried,
      addedVariables,
    ),
    ...requestAt(`${prefix}.attachments.fetch`, carried, addedVariables),
  ];
};

const eventsAt = (prefix: string, trigger: Scope) => {
  const addedVariables: readonly ExpressionAddedVariable[] = ['item'];

  return [
    at(`${prefix}.forEach`, trigger, { returns: 'list' }),
    at(`${prefix}.when`, trigger, { returns: 'bool', addedVariables }),
    ...requestAt(`${prefix}.lookup.request`, trigger, addedVariables),
    at(`${prefix}.lookup.capture.${ANY_SEGMENT}`, answered(trigger), {
      addedVariables,
    }),
    ...raiseAt(`${prefix}.raise`, trigger),
  ];
};

export const EXPRESSION_POSITIONS: readonly ExpressionPosition[] = [
  ...verifyAt('webhook.verify', DELIVERED),
  at('webhook.respond.when', DELIVERED, { returns: 'bool' }),
  at('webhook.respond.body', DELIVERED),
  at('webhook.ignoreWhen', DELIVERED, { returns: 'bool' }),
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
    { addedVariables: ['inputs'] },
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
