import type {
  ExpressionAddedVariable,
  ExpressionReturns,
} from '@integrations/application/dto/expression-check.dto';
import {
  ACTION_CALLERS,
  type ActionCaller,
  sendsFiles,
} from '@integrations/domain/value-objects/action-caller.vo';
import {
  ABOUT_A_TASK,
  BINDING_SUBJECTS,
} from '@integrations/domain/value-objects/binding.vo';
import { ExpressionPosition } from '@integrations/infrastructure/integrations/expression-position';
import {
  ACTING,
  ADDRESSING,
  answered,
  attaching,
  COMPLETING,
  DEFAULTING,
  DELIVERED,
  LINKED,
  OUTSIDE,
  MARKING,
  POLLED,
  POLLING,
  PREPARING,
  SENDING,
  UPLOADING,
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
    [],
  );

const each = (
  prefix: string,
  fields: readonly string[],
  scope: Scope,
  addedVariables: readonly ExpressionAddedVariable[],
) => fields.map((field) => at(`${prefix}.${field}`, scope, { addedVariables }));

const callableBy = (
  callers: readonly ActionCaller[],
  positions: readonly ExpressionPosition[],
) => positions.map((position) => position.callableBy(callers));

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

const SENT = ['url', `query.${ANY_SEGMENT}`, `headers.${ANY_SEGMENT}`];

const requestAt = (
  prefix: string,
  scope: Scope,
  addedVariables: readonly ExpressionAddedVariable[] = [],
  sent: readonly string[] = [...SENT, 'body'],
) => [
  ...each(prefix, sent, scope, addedVariables),
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
        'author.email',
        'opens.title',
        'opens.description',
        'opens.assignBy.email',
        'opens.chat.by.email',
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
  ...callableBy(ACTION_CALLERS, [
    ...requestAt(`actions.${ANY_SEGMENT}.request`, ACTING, ['inputs']),
  ]),
  ...callableBy(ACTION_CALLERS.filter(sendsFiles), [
    at(`actions.${ANY_SEGMENT}.uploads.each`, UPLOADING, {
      returns: 'list',
    }),
    ...requestAt(`actions.${ANY_SEGMENT}.uploads.prepare`, PREPARING),
    ...requestAt(`actions.${ANY_SEGMENT}.uploads.send`, SENDING, [], SENT),
    ...requestAt(`actions.${ANY_SEGMENT}.uploads.complete`, COMPLETING),
    ...requestAt(`actions.${ANY_SEGMENT}.uploads.ready`, SENDING),
  ]),
  at(`tools.${ANY_SEGMENT}.inputs.${ANY_SEGMENT}.default`, DEFAULTING),
  ...callableBy(
    ['tool'],
    [
      at(
        `tools.${ANY_SEGMENT}.output`,
        ACTING.and({
          response: OUTSIDE,
          status: OUTSIDE,
          capture: 'map<string, dyn>',
        }),
        { addedVariables: ['inputs'] },
      ),
    ],
  ),
  at('connection.oauth2.identity', LINKED),
  ...callableBy(BINDING_SUBJECTS, [
    at(`on.${ANY_SEGMENT}.${ANY_SEGMENT}.to.${ANY_SEGMENT}`, ADDRESSING),
  ]),
  ...callableBy(ABOUT_A_TASK, [
    at(`on.${ANY_SEGMENT}.${ANY_SEGMENT}.mark.${ANY_SEGMENT}.value`, MARKING),
  ]),
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
