import { isDeepStrictEqual } from 'node:util';

import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import {
  type CelVariables,
  sanitizedForCel,
} from '@platform/expressions/cel-variables';
import type { ExpressionCheck } from '@platform/expressions/expression-engine.port';
import {
  type Declared,
  type NamedType,
  type SchemaFields,
  Scope,
} from '@platform/expressions/scope';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

type Scalar = 'string' | 'int' | 'double' | 'bool';

type Kind =
  | { readonly of: Scalar | 'dyn' }
  | { readonly of: 'list'; readonly element: Kind }
  | { readonly of: 'map'; readonly value: Kind }
  | { readonly of: 'schema'; readonly fields: readonly Field[] }
  | {
      readonly of: 'named';
      readonly name: string;
      readonly fields: readonly Field[];
    };

type Field = readonly [name: string, kind: Kind];

interface Leaf {
  readonly source: string;
  readonly kind: Kind;
}

interface Drawn {
  readonly variables: readonly Field[];
  readonly source: string;
  readonly values: CelVariables;
  readonly others: CelVariables;
}

const RUNS = { numRuns: 1_000 };

const engine = new CelExpressionEngine();

const STRING: Kind = { of: 'string' };
const INT: Kind = { of: 'int' };
const DOUBLE: Kind = { of: 'double' };
const BOOL: Kind = { of: 'bool' };
const DYN: Kind = { of: 'dyn' };

const listOf = (element: Kind): Kind => ({ of: 'list', element });
const mapOf = (value: Kind): Kind => ({ of: 'map', value });

const VALUE_ERRORS = new Set([
  'no_such_key',
  'index_out_of_range',
  'index_out_of_bounds',
  'division_by_zero',
  'modulo_by_zero',
  'numeric_overflow',
  'int_conversion_error',
  'double_conversion_error',
]);

const NAMES = ['task', 'ask', 'event', 'target', 'issue', 'body'];

const FIELDS = ['line', 'title', 'marks', 'state', 'name', 'points', 'size'];

const KEYS = ['a', 'b', 'linear.issue', 'Done', ''];

const typeOf = (kind: Kind): string => {
  switch (kind.of) {
    case 'list':
      return `list<${typeOf(kind.element)}>`;
    case 'map':
      return `map<string, ${typeOf(kind.value)}>`;
    case 'schema':
      return 'schema';
    case 'named':
      return kind.name;
    case 'string':
    case 'int':
    case 'double':
    case 'bool':
    case 'dyn':
      return kind.of;
  }
};

const schemaOf = (fields: readonly Field[]): SchemaFields =>
  Object.fromEntries(
    fields.map(([name, kind]) => [
      name,
      kind.of === 'schema' ? schemaOf(kind.fields) : typeOf(kind),
    ]),
  );

const declaredOf = (kind: Kind): Declared =>
  kind.of === 'schema' ? { schema: schemaOf(kind.fields) } : typeOf(kind);

const namedIn = (variables: readonly Field[]): NamedType[] =>
  variables.flatMap(([, kind]) =>
    kind.of === 'named' ? [[kind.name, schemaOf(kind.fields)] as const] : [],
  );

const scopeOf = (variables: readonly Field[]): Scope =>
  Scope.of(
    Object.fromEntries(
      variables.map(([name, kind]) => [name, declaredOf(kind)]),
    ),
  ).typed(namedIn(variables));

const scalar = fc.constantFrom<Kind>(STRING, INT, DOUBLE, BOOL);

const plain = fc.oneof(
  { weight: 4, arbitrary: scalar },
  { weight: 1, arbitrary: scalar.map(listOf) },
  { weight: 1, arbitrary: scalar.map(mapOf) },
);

const fieldsOf = (inner: fc.Arbitrary<Kind>): fc.Arbitrary<readonly Field[]> =>
  fc.uniqueArray(fc.tuple(fc.constantFrom(...FIELDS), inner), {
    minLength: 1,
    maxLength: 3,
    selector: ([name]) => name,
  });

const typedKind = (named: boolean): fc.Arbitrary<Kind> =>
  fc.oneof(
    { weight: 3, arbitrary: plain },
    {
      weight: 2,
      arbitrary: fieldsOf(
        fc.oneof(
          { weight: 3, arbitrary: plain },
          {
            weight: 1,
            arbitrary: fieldsOf(plain).map((fields): Kind => ({
              of: 'schema',
              fields,
            })),
          },
        ),
      ).map((fields): Kind =>
        named
          ? { of: 'named', name: 'Issue', fields }
          : { of: 'schema', fields },
      ),
    },
  );

const variablesOf = (dyn: boolean): fc.Arbitrary<readonly Field[]> =>
  fc
    .uniqueArray(fc.constantFrom(...NAMES), { minLength: 1, maxLength: 4 })
    .chain((names) =>
      fc.tuple(
        ...names.map((name, at) =>
          (dyn && at === 0 ? fc.constant(DYN) : typedKind(at === 1)).map(
            (kind): Field => [name, kind],
          ),
        ),
      ),
    );

const text = fc.oneof(
  { weight: 2, arbitrary: fc.constantFrom(...KEYS) },
  { weight: 1, arbitrary: fc.string({ maxLength: 6 }) },
);

const INT_RANGE = { min: -(2n ** 63n), max: 2n ** 63n - 1n };

const valueOf = (kind: Kind): fc.Arbitrary<unknown> => {
  switch (kind.of) {
    case 'string':
      return text;
    case 'int':
      return fc.oneof(fc.bigInt({ min: -3n, max: 3n }), fc.bigInt(INT_RANGE));
    case 'double':
      return fc.oneof(fc.constantFrom(0, 1, -1, 1.5), fc.double());
    case 'bool':
      return fc.boolean();
    case 'dyn':
      return fc.jsonValue({ maxDepth: 2 }).map(sanitizedForCel);
    case 'list':
      return fc.array(valueOf(kind.element), { maxLength: 4 });
    case 'map':
      return fc
        .uniqueArray(fc.tuple(text, valueOf(kind.value)), {
          maxLength: 4,
          selector: ([key]) => key,
        })
        .map((entries) => Object.fromEntries(entries));
    case 'schema':
    case 'named':
      return fc
        .tuple(
          ...kind.fields.map(([name, inner]) =>
            valueOf(inner).map((each) => [name, each] as const),
          ),
        )
        .map((entries) => Object.fromEntries(entries));
  }
};

const valuesOf = (variables: readonly Field[]): fc.Arbitrary<CelVariables> =>
  fc
    .tuple(
      ...variables.map(([name, kind]) =>
        valueOf(kind).map((each) => [name, each] as const),
      ),
    )
    .map((entries) => Object.fromEntries(entries));

const leavesOf = (source: string, kind: Kind): Leaf[] => [
  { source, kind },
  ...(kind.of === 'schema' || kind.of === 'named'
    ? kind.fields.flatMap(([name, inner]) =>
        leavesOf(`${source}.${name}`, inner),
      )
    : []),
];

const sameKind = (one: Kind, other: Kind): boolean =>
  typeOf(one) === typeOf(other) && one.of !== 'schema';

const COMPARABLE: readonly Kind[] = [STRING, INT, DOUBLE, BOOL, listOf(STRING)];

const ORDERED: readonly Kind[] = [STRING, INT, DOUBLE];

const LISTED: readonly Kind[] = [STRING, INT, DOUBLE];

const literalOf = (kind: Kind): fc.Arbitrary<string> => {
  switch (kind.of) {
    case 'string':
      return text.map((each) => JSON.stringify(each));
    case 'int':
      return fc.constantFrom('0', '1', '2', '-3', '9223372036854775807');
    case 'double':
      return fc.constantFrom('0.0', '1.5', '-2.5', '1e300');
    case 'bool':
      return fc.constantFrom('true', 'false');
    case 'list':
      return fc
        .array(literalOf(kind.element), { minLength: 1, maxLength: 3 })
        .map((each) => `[${each.join(', ')}]`);
    case 'map':
      return fc
        .uniqueArray(fc.tuple(text, literalOf(kind.value)), {
          maxLength: 3,
          selector: ([key]) => key,
        })
        .map(
          (entries) =>
            `{${entries.map(([key, each]) => `${JSON.stringify(key)}: ${each}`).join(', ')}}`,
        );
    case 'dyn':
    case 'schema':
    case 'named':
      return fc.constant('null');
  }
};

class Grammar {
  private readonly made = new Map<string, fc.Arbitrary<string>>();

  constructor(
    private readonly leaves: readonly Leaf[],
    private readonly bound: number,
  ) {}

  of(kind: Kind, depth: number): fc.Arbitrary<string> {
    const key = `${typeOf(kind)}@${depth}`;
    const known = this.made.get(key);

    if (known) {
      return known;
    }

    const built = fc.constant(null).chain(() => this.build(kind, depth));
    this.made.set(key, built);

    return built;
  }

  any(depth: number): fc.Arbitrary<string> {
    return fc
      .constantFrom<Kind>(...COMPARABLE, listOf(INT), mapOf(STRING))
      .chain((kind) => this.of(kind, depth));
  }

  wild(depth: number): fc.Arbitrary<string> {
    const deeper = this.any(depth - 1);

    return fc.oneof(
      fc
        .tuple(
          deeper,
          fc.constantFrom('+', '-', '*', '/', '%', '==', '<', '&&', 'in'),
          deeper,
        )
        .map(([left, op, right]) => `(${left} ${op} ${right})`),
      deeper.map((each) => `!${each}`),
      deeper.map((each) => `size(${each})`),
      fc
        .tuple(deeper, fc.constantFrom(...FIELDS))
        .map(([each, field]) => `${each}.${field}`),
      fc.tuple(deeper, deeper).map(([one, other]) => `${one}[${other}]`),
      fc
        .tuple(
          fc.constantFrom(...this.leaves.map((leaf) => leaf.source)),
          fc.constantFrom(...FIELDS),
        )
        .map(([leaf, field]) => `${leaf}.${field}`),
      fc
        .constantFrom(...this.leaves.map((leaf) => leaf.source))
        .map((leaf) => `${leaf.slice(1)}${leaf.slice(0, 1)}`),
    );
  }

  private within(element: Kind): { name: string; grammar: Grammar } {
    const name = `each${this.bound}`;

    return {
      name,
      grammar: new Grammar(
        [...this.leaves, { source: name, kind: element }],
        this.bound + 1,
      ),
    };
  }

  private listed(depth: number): fc.Arbitrary<readonly [Kind, string]> {
    return fc
      .constantFrom(...LISTED)
      .chain((element) =>
        this.of(listOf(element), depth).map(
          (source) => [element, source] as const,
        ),
      );
  }

  private macro(
    depth: number,
    body: (grammar: Grammar, element: Kind) => fc.Arbitrary<string>,
    shape: (list: string, name: string, inner: string) => string,
  ): fc.Arbitrary<string> {
    return this.listed(depth).chain(([element, list]) => {
      const { name, grammar } = this.within(element);

      return body(grammar, element).map((inner) => shape(list, name, inner));
    });
  }

  private build(kind: Kind, depth: number): fc.Arbitrary<string> {
    const leaves = this.leaves
      .filter((leaf) => sameKind(leaf.kind, kind))
      .map((leaf) => leaf.source);
    const base = fc.oneof(
      { weight: 1, arbitrary: literalOf(kind) },
      ...(leaves.length > 0
        ? [{ weight: 3, arbitrary: fc.constantFrom(...leaves) }]
        : []),
    );

    if (depth <= 0) {
      return base;
    }

    const composite = this.composites(kind, depth - 1);

    return composite.length === 0
      ? base
      : fc.oneof(
          { weight: 2, arbitrary: base },
          ...composite.map((arbitrary) => ({ weight: 1, arbitrary })),
        );
  }

  private binary(kind: Kind, depth: number, ops: readonly string[]) {
    const side = this.of(kind, depth);

    return fc
      .tuple(side, fc.constantFrom(...ops), side)
      .map(([left, op, right]) => `(${left} ${op} ${right})`);
  }

  private ternary(kind: Kind, depth: number): fc.Arbitrary<string> {
    return fc
      .tuple(this.of(BOOL, depth), this.of(kind, depth), this.of(kind, depth))
      .map(([when, then, otherwise]) => `(${when} ? ${then} : ${otherwise})`);
  }

  private indexed(kind: Kind, depth: number): fc.Arbitrary<string>[] {
    const lists = this.leaves.filter((leaf) =>
      sameKind(leaf.kind, listOf(kind)),
    );
    const maps = this.leaves.filter((leaf) => sameKind(leaf.kind, mapOf(kind)));

    return [
      ...(lists.length > 0
        ? [
            fc
              .tuple(
                fc.constantFrom(...lists.map((leaf) => leaf.source)),
                this.of(INT, depth),
              )
              .map(([list, at]) => `${list}[${at}]`),
          ]
        : []),
      ...(maps.length > 0
        ? [
            fc
              .tuple(
                fc.constantFrom(...maps.map((leaf) => leaf.source)),
                this.of(STRING, depth),
              )
              .map(([map, key]) => `${map}[${key}]`),
          ]
        : []),
    ];
  }

  private composites(kind: Kind, depth: number): fc.Arbitrary<string>[] {
    switch (kind.of) {
      case 'string':
        return [
          this.binary(STRING, depth, ['+']),
          this.ternary(STRING, depth),
          ...this.indexed(STRING, depth),
          this.of(INT, depth).map((each) => `string(${each})`),
          this.of(DOUBLE, depth).map((each) => `string(${each})`),
          this.of(STRING, depth).map((each) => `htmlUnescape(${each})`),
        ];
      case 'int':
        return [
          this.binary(INT, depth, ['+', '-', '*', '/', '%']),
          this.of(INT, depth).map((each) => `-${each}`),
          this.ternary(INT, depth),
          ...this.indexed(INT, depth),
          this.of(STRING, depth).map((each) => `size(${each})`),
          this.listed(depth).map(([, list]) => `size(${list})`),
          this.of(DOUBLE, depth).map((each) => `int(${each})`),
          this.of(STRING, depth).map((each) => `int(${each})`),
        ];
      case 'double':
        return [
          this.binary(DOUBLE, depth, ['+', '-', '*', '/']),
          this.ternary(DOUBLE, depth),
          ...this.indexed(DOUBLE, depth),
          this.of(INT, depth).map((each) => `double(${each})`),
        ];
      case 'bool':
        return [
          fc
            .constantFrom(...COMPARABLE)
            .chain((each) => this.binary(each, depth, ['==', '!='])),
          fc
            .constantFrom(...ORDERED)
            .chain((each) => this.binary(each, depth, ['<', '<=', '>', '>='])),
          this.binary(BOOL, depth, ['&&', '||']),
          this.of(BOOL, depth).map((each) => `!${each}`),
          this.ternary(BOOL, depth),
          ...this.indexed(BOOL, depth),
          fc
            .tuple(
              this.of(STRING, depth),
              fc.constantFrom('startsWith', 'endsWith', 'contains'),
              this.of(STRING, depth),
            )
            .map(([one, call, other]) => `${one}.${call}(${other})`),
          this.listed(depth).chain(([element, list]) =>
            this.of(element, depth).map((each) => `(${each} in ${list})`),
          ),
          ...this.has(),
          this.macro(
            depth,
            (grammar) => grammar.of(BOOL, depth),
            (list, name, inner) => `${list}.exists(${name}, ${inner})`,
          ),
          this.macro(
            depth,
            (grammar) => grammar.of(BOOL, depth),
            (list, name, inner) => `${list}.all(${name}, ${inner})`,
          ),
        ];
      case 'list':
        return [
          this.binary(kind, depth, ['+']),
          fc
            .array(this.of(kind.element, depth), { minLength: 1, maxLength: 3 })
            .map((each) => `[${each.join(', ')}]`),
          this.of(kind, depth).chain((list) => {
            const { name, grammar } = this.within(kind.element);

            return grammar
              .of(BOOL, depth)
              .map((inner) => `${list}.filter(${name}, ${inner})`);
          }),
          this.listed(depth).chain(([element, list]) => {
            const { name, grammar } = this.within(element);

            return grammar
              .of(kind.element, depth)
              .map((inner) => `${list}.map(${name}, ${inner})`);
          }),
        ];
      case 'map':
        return [
          fc
            .uniqueArray(fc.tuple(text, this.of(kind.value, depth)), {
              minLength: 1,
              maxLength: 3,
              selector: ([key]) => key,
            })
            .map(
              (entries) =>
                `{${entries.map(([key, each]) => `${JSON.stringify(key)}: ${each}`).join(', ')}}`,
            ),
        ];
      case 'dyn':
      case 'schema':
      case 'named':
        return [];
    }
  }

  private has(): fc.Arbitrary<string>[] {
    const fields = this.leaves.filter(
      (leaf) => leaf.source.includes('.') && !leaf.source.startsWith('each'),
    );

    return fields.length > 0
      ? [fc.constantFrom(...fields.map((leaf) => `has(${leaf.source})`))]
      : [];
  }
}

const expressionOf = (variables: readonly Field[]): fc.Arbitrary<string> => {
  const grammar = new Grammar(
    variables.flatMap(([name, kind]) => leavesOf(name, kind)),
    0,
  );

  return fc.oneof(
    { weight: 4, arbitrary: grammar.any(3) },
    { weight: 2, arbitrary: grammar.of(BOOL, 3) },
    { weight: 1, arbitrary: grammar.wild(3) },
  );
};

const drawnOver = (dyn: boolean): fc.Arbitrary<Drawn> =>
  variablesOf(dyn).chain((variables) =>
    fc.record({
      variables: fc.constant(variables),
      source: expressionOf(variables),
      values: valuesOf(variables),
      others: valuesOf(variables),
    }),
  );

const typed = drawnOver(false);

const withDyn = drawnOver(true);

type Outcome =
  | { readonly read: unknown }
  | { readonly failed: string; readonly code: unknown };

const outcomeOf = (evaluate: () => unknown): Outcome => {
  try {
    return { read: evaluate() };
  } catch (error) {
    return {
      failed: error instanceof Error ? error.name : 'unknown',
      code: (error as { code?: unknown } | null)?.code,
    };
  }
};

const checked = ({ variables, source }: Drawn): ExpressionCheck =>
  engine.check(source, scopeOf(variables));

const splitTypes = (inner: string): string[] => {
  let depth = 0;
  let from = 0;
  const parts: string[] = [];

  for (const [at, char] of [...inner].entries()) {
    depth += char === '<' ? 1 : char === '>' ? -1 : 0;

    if (char === ',' && depth === 0) {
      parts.push(inner.slice(from, at).trim());
      from = at + 1;
    }
  }

  return [...parts, inner.slice(from).trim()];
};

const fits = (value: unknown, type: string): boolean => {
  const generic = /^(list|map)<(.*)>$/.exec(type);

  if (generic) {
    const [, outer, inner = ''] = generic;
    const [first = 'dyn', second = 'dyn'] = splitTypes(inner);

    return outer === 'list'
      ? Array.isArray(value) && value.every((each) => fits(each, first))
      : typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value) &&
          Object.values(value).every((each) => fits(each, second));
  }

  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'int':
      return typeof value === 'bigint';
    case 'double':
      return typeof value === 'number';
    case 'bool':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    case 'list':
      return Array.isArray(value);
    default:
      return true;
  }
};

const failsOnlyOnValues = (outcome: Outcome): boolean =>
  !('failed' in outcome) ||
  (outcome.failed === 'EvaluationError' &&
    typeof outcome.code === 'string' &&
    VALUE_ERRORS.has(outcome.code));

const reordered = <T>(items: readonly T[]): fc.Arbitrary<T[]> =>
  fc.shuffledSubarray([...items], {
    minLength: items.length,
    maxLength: items.length,
  });

const shuffledKind = (kind: Kind): fc.Arbitrary<Kind> =>
  kind.of === 'schema' || kind.of === 'named'
    ? reordered(kind.fields)
        .chain((fields) =>
          fc.tuple(
            ...fields.map(([name, inner]) =>
              shuffledKind(inner).map((each): Field => [name, each]),
            ),
          ),
        )
        .map((fields) => ({ ...kind, fields }))
    : fc.constant(kind);

describe('a checked expression under any values of the declared types', () => {
  it('fails at run time only on the values it reads, never on their types', () => {
    fc.assert(
      fc.property(typed, (drawn) => {
        const check = checked(drawn);

        return (
          !check.valid ||
          failsOnlyOnValues(
            outcomeOf(() =>
              engine.compile(drawn.source).evaluate(drawn.values),
            ),
          )
        );
      }),
      RUNS,
    );
  });

  it('evaluates to a value of the type the check names', () => {
    fc.assert(
      fc.property(typed, (drawn) => {
        const check = checked(drawn);

        if (!check.valid) {
          return true;
        }

        const outcome = outcomeOf(() =>
          engine.compile(drawn.source).evaluate(drawn.values),
        );

        return !('read' in outcome) || fits(outcome.read, check.type);
      }),
      RUNS,
    );
  });

  it('checks the same whatever order the names, fields and types are declared in', () => {
    fc.assert(
      fc.property(
        fc.oneof(typed, withDyn).chain((drawn) =>
          reordered(drawn.variables)
            .chain((variables) =>
              fc.tuple(
                ...variables.map(([name, kind]) =>
                  shuffledKind(kind).map((each): Field => [name, each]),
                ),
              ),
            )
            .map((variables) => ({ drawn, variables })),
        ),
        ({ drawn, variables }) =>
          isDeepStrictEqual(checked(drawn), checked({ ...drawn, variables })),
      ),
      RUNS,
    );
  });

  it('gives the same result each time it is evaluated, whatever it read before', () => {
    fc.assert(
      fc.property(fc.oneof(typed, withDyn), (drawn) => {
        const once = engine.compile(drawn.source);
        const first = outcomeOf(() => once.evaluate(drawn.values));

        outcomeOf(() => once.evaluate(drawn.others));

        return (
          isDeepStrictEqual(
            first,
            outcomeOf(() => once.evaluate(drawn.values)),
          ) &&
          isDeepStrictEqual(
            first,
            outcomeOf(() =>
              engine.compile(drawn.source).evaluate(drawn.values),
            ),
          )
        );
      }),
      RUNS,
    );
  });
});

describe('the CEL library under the engine', () => {
  it.fails('converts the items of a list joined to an empty list', () => {
    expect(engine.compile('int(([] + ["7"])[0]) + 1').evaluate({})).toBe(8n);
  });

  it.fails('refuses to convert an empty string to an int', () => {
    expect(() => engine.compile('int("")').evaluate({})).toThrow(
      'cannot convert to int',
    );
  });
});
