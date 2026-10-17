import type {
  ExpressionDeclarationDto,
  ExpressionPositionDto,
} from '@integrations/application/dto/expression-check.dto';
import type { CheckedExpression } from '@integrations/application/ports/expression-checks.port';
import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import {
  checkedAgainst,
  type Returns,
} from '@integrations/infrastructure/hooks/hook.compile';
import { hookSchema } from '@integrations/infrastructure/hooks/hook.schema';
import {
  ANY_EVENT,
  ANY_STEP,
  firingScope,
  steppingScope,
} from '@integrations/infrastructure/hooks/hook-scopes';
import type { ExpressionEnginePort } from '@platform/expressions/expression-engine.port';
import type {
  Declared,
  SchemaFields,
  Scope,
} from '@platform/expressions/scope';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import {
  ANY_SEGMENT,
  FieldPath,
} from '@shared-kernel/domain/value-objects/field-path.vo';

const HOOK_RESOURCE = 'hook';

const OBJECT = 'object';

const fieldsOf = (fields: SchemaFields): ExpressionDeclarationDto[] =>
  Object.entries(fields)
    .sort(([one], [other]) => one.localeCompare(other))
    .map(([name, field]) =>
      typeof field === 'string'
        ? { name, type: field, fields: [] }
        : { name, type: OBJECT, fields: fieldsOf(field) },
    );

const declarationsOf = (
  declared: Readonly<Record<string, Declared>>,
): ExpressionDeclarationDto[] =>
  fieldsOf(
    Object.fromEntries(
      Object.entries(declared).map(([name, each]) => [
        name,
        typeof each === 'string' ? each : each.schema,
      ]),
    ),
  );

const positioned = (
  dotted: string,
  scope: Scope,
  returns: Returns,
): ExpressionPositionDto => ({
  position: FieldPath.dotted(`${HOOK_RESOURCE}.${dotted}`),
  returns,
  sees: declarationsOf(scope.declared),
  alsoSees: [],
});

const STEP = `steps.${ANY_SEGMENT}`;

const POSITIONS: readonly ExpressionPositionDto[] = [
  positioned('when', ANY_EVENT, 'bool'),
  positioned(`${STEP}.with.${ANY_SEGMENT}`, ANY_STEP, null),
  positioned(`${STEP}.request.url`, ANY_STEP, null),
  positioned(`${STEP}.request.headers.${ANY_SEGMENT}`, ANY_STEP, null),
  positioned(`${STEP}.request.body`, ANY_STEP, null),
];

type Placed = { readonly scope: Scope; readonly returns: Returns } | null;

const placeOf = (
  within: FieldPath,
  on: HookEventName,
  steps: readonly { readonly name: string }[],
): Placed => {
  const [first, index, kind, part] = within.segments;

  if (first === 'when' && within.segments.length === 1) {
    return { scope: firingScope(on), returns: 'bool' };
  }

  if (first !== 'steps' || typeof index !== 'number' || !steps[index]) {
    return null;
  }

  const scope = steppingScope(
    on,
    steps.slice(0, index).map((step) => step.name),
  );
  const writable =
    (kind === 'with' && within.segments.length >= 4) ||
    (kind === 'request' &&
      (part === 'url' || part === 'headers' || part === 'body'));

  return writable ? { scope, returns: null } : null;
};

export class HookExpressionChecks {
  constructor(private readonly expressions: ExpressionEnginePort) {}

  concerns(position: FieldPath): boolean {
    return position.segments[0] === HOOK_RESOURCE;
  }

  check(
    position: FieldPath,
    expression: string,
    definition: unknown,
  ): CheckedExpression {
    const read = hookSchema.safeParse(definition);

    if (!read.success) {
      return {
        outcome: 'invalid',
        problems: read.error.issues.map((issue) =>
          ConfigurationProblem.of({
            path: '',
            at: FieldPath.of(issue.path),
            reason: issue.message,
          }),
        ),
      };
    }

    const place = placeOf(
      FieldPath.of(position.segments.slice(1)),
      read.data.on as HookEventName,
      read.data.steps,
    );

    if (!place) {
      return { outcome: 'no-expression-there' };
    }

    const verdict = checkedAgainst(
      this.expressions,
      expression,
      place.scope,
      place.returns,
    );

    return {
      outcome: 'checked',
      check: { type: verdict.type, errors: verdict.errors, warnings: [] },
    };
  }

  positions(): readonly ExpressionPositionDto[] {
    return POSITIONS;
  }
}
