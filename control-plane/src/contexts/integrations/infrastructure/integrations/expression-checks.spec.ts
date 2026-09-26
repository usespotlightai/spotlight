import { ExpressionChecks } from '@integrations/infrastructure/integrations/expression-checks';
import {
  EXPRESSION_POSITIONS,
  positionAt,
} from '@integrations/infrastructure/integrations/expression-positions';
import { compileIntegration } from '@integrations/infrastructure/integrations/integration.compile';
import {
  isExpression,
  written,
} from '@integrations/infrastructure/integrations/integration.schema';
import { PIECE } from '@integrations/infrastructure/integrations/templating';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { describe, expect, it } from 'vitest';

const expressions = new CelExpressionEngine();
const checks = new ExpressionChecks(expressions);

const e = (source: string) => `\${{ ${source} }}`;

const LINEAR = {
  integration: 'linear',
  webhook: {
    verify: { hmac: { secret: 'secret.LINEAR_SIGNING', header: 'signature' } },
    events: [
      {
        when: e('body.type == "Issue"'),
        raise: {
          happening: 'linear.issue.completed',
          marks: [{ kind: 'linear.issue', value: e('body.data.identifier') }],
        },
      },
      {
        forEach: e('body.issues'),
        when: e('item.done'),
        lookup: {
          request: { url: `https://api.linear.app/issues/${e('item.id')}` },
          capture: { issue: e('response.issue'), body: e('response.body') },
        },
        raise: {
          happening: 'linear.issue.closed',
          say: e('issue.title'),
          marks: [{ kind: 'linear.issue', value: e('issue.id') }],
        },
      },
    ],
  },
  actions: {
    comment: {
      request: {
        url: 'https://api.linear.app/graphql',
        body: { query: e('inputs.issue'), urgent: e('inputs.urgent') },
      },
    },
  },
  tools: {
    comment: {
      description: 'Comment on an issue',
      does: 'comment',
      inputs: { issue: { type: 'string' }, urgent: { type: 'boolean' } },
    },
  },
  on: {
    'task.opened': {
      do: 'comment',
      to: { thread: e('task.marks["slack.thread"] + ask.bdoy') },
    },
  },
};

const HINTED = {
  ...LINEAR,
  types: { Issue: { identifier: 'string', title: 'string' } },
  webhook: {
    ...LINEAR.webhook,
    shape: { type: 'string', data: 'Issue' },
    events: [
      {
        when: e('body.type == "Issue"'),
        raise: {
          happening: 'linear.issue.completed',
          marks: [{ kind: 'linear.issue', value: e('body.data.identifer') }],
        },
      },
    ],
  },
};

const placesOf = (definition: unknown) => {
  const compiled = compileIntegration(definition, expressions);

  if (!compiled.ok) {
    throw new Error(compiled.problems.map((each) => each.reason).join('\n'));
  }

  return compiled;
};

const answer = (position: string, expression: string, definition: unknown) =>
  checks.check(FieldPath.parsed(position) as FieldPath, expression, definition);

const checked = (
  position: string,
  expression: string,
  definition: unknown = LINEAR,
) => {
  const answered = answer(position, expression, definition);

  if (answered.outcome !== 'checked') {
    throw new Error(JSON.stringify(answered));
  }

  return answered.check;
};

const refused = (
  position: string,
  expression: string,
  definition: unknown = LINEAR,
) => {
  const answered = answer(position, expression, definition);

  return answered.outcome === 'invalid'
    ? answered.problems.map((each) => ({
        at: each.field.rendered,
        reason: each.reason,
      }))
    : [];
};

const outcomeOf = (position: string) =>
  answer(position, 'true', LINEAR).outcome;

const WHEN = 'integration.webhook.events[0].when';
const WALKING = 'integration.webhook.events[1].when';
const THREAD = 'integration.on["task.opened"].to.thread';

describe('checking an expression where a definition holds it', () => {
  it('answers the type a sound one evaluates to', () => {
    expect(checked(WHEN, 'body.type == "Issue"')).toEqual({
      type: 'bool',
      errors: [],
      warnings: [],
    });
  });

  it('refuses a when that does not return a bool', () => {
    expect(checked(WHEN, ' "Issue" ').errors).toEqual([
      {
        message: 'must return a bool, not a string',
        span: { start: 1, end: 8 },
        suggestion: null,
      },
    ]);
  });

  it('points at a misspelt field and suggests the one meant', () => {
    expect(checked(THREAD, 'ask.bdoy').errors).toEqual([
      {
        message: 'No such key: bdoy',
        span: { start: 4, end: 8 },
        suggestion: 'ask.body',
      },
    ]);
  });

  it('gives item only to an event that walks a list', () => {
    expect(checked(WALKING, 'item.done').errors).toEqual([]);
    expect(checked(WHEN, 'item.done').errors[0]?.message).toBe(
      'Unknown variable: item',
    );
    expect(
      checked('integration.webhook.events[1].forEach', 'item').errors[0]
        ?.message,
    ).toBe('Unknown variable: item');
  });

  it('gives a raise what its lookup captured', () => {
    expect(
      checked('integration.webhook.events[1].raise.say', 'issue.title').errors,
    ).toEqual([]);
  });

  it('gives an action the inputs of the tools that do it, as their types', () => {
    const position = 'integration.actions.comment.request.body.urgent';

    expect(checked(position, 'inputs.urgent')).toMatchObject({
      type: 'bool',
      errors: [],
    });
    expect(checked(position, 'inputs.isue').errors[0]?.suggestion).toBe(
      'inputs.issue',
    );
  });

  it('lets no expression read a secret, not even a request’s', () => {
    expect(
      checked('integration.actions.comment.request.body.query', 'secret.KEY')
        .errors[0]?.message,
    ).toBe('Unknown variable: secret');
    expect(
      EXPRESSION_POSITIONS.filter((each) => 'secret' in each.scope.declared),
    ).toEqual([]);
  });

  it('reads the type hints the definition declares', () => {
    const position = 'integration.webhook.events[0].raise.marks[0].value';

    expect(checked(position, 'body.data.identifer', HINTED).errors).toEqual([
      expect.objectContaining({ suggestion: 'body.data.identifier' }),
    ]);
    expect(checked(position, 'body.data.identifer').errors).toEqual([]);
  });

  it('warns where a capture shadows a name Spotlight gives', () => {
    expect(
      checked('integration.webhook.events[1].raise.say', 'issue.title')
        .warnings,
    ).toEqual([
      {
        position: positionAt(
          FieldPath.parsed(
            'webhook.events[1].lookup.capture.body',
          ) as FieldPath,
        ),
        message: 'shadows the built-in body',
      },
    ]);
  });
});

describe('a definition that is not valid', () => {
  it('is refused with every error it holds, where it holds it', () => {
    expect(
      refused(WHEN, 'true', {
        ...LINEAR,
        webhook: {
          ...LINEAR.webhook,
          events: [
            { ...LINEAR.webhook.events[0], raise: { happening: 'Not A Name' } },
          ],
        },
        actions: {
          ...LINEAR.actions,
          broken: { request: { method: 'FETCH' } },
        },
      }),
    ).toEqual([
      {
        at: 'webhook.events[0].raise.happening',
        reason: 'names its source first, as in slack.app_mention',
      },
      {
        at: 'actions.broken.request.method',
        reason: expect.any(String),
      },
      {
        at: 'actions.broken.request.url',
        reason: expect.any(String),
      },
    ]);
  });

  it('is refused where the definition compiles but not whole', () => {
    expect(
      refused(THREAD, 'ask.body', {
        ...LINEAR,
        on: { 'task.opened': { ...LINEAR.on['task.opened'], do: 'missing' } },
      }).map((each) => each.at),
    ).toEqual(['on["task.opened"].do']);
  });

  it('is still checked where it only warns', () => {
    expect(checked(THREAD, 'ask.body').errors).toEqual([]);
  });

  it('refuses something that is not a definition at all', () => {
    expect(refused(WHEN, 'true', 'linear').map((each) => each.at)).toEqual([
      '',
    ]);
  });
});

describe('a position that names no expression', () => {
  it('is refused where the definition holds none there', () => {
    for (const position of [
      'integration.webhook.events[0].raise.happening',
      'integration.webhook.events[7].when',
      'integration.webhook.events[*].when',
    ]) {
      expect(outcomeOf(position)).toBe('no-expression-there');
    }
  });

  it('is refused where it is not an integration’s', () => {
    expect(outcomeOf('line.stations[0].check')).toBe('no-such-resource');
    expect(outcomeOf('integration')).toBe('no-such-resource');
  });
});

describe('the check and the compiler', () => {
  const doubted = (message: string, suggestion: string | null) =>
    suggestion
      ? `does not check: ${message}; did you mean ${suggestion}?`
      : `does not check: ${message}`;

  const valueAt = (held: unknown, field: FieldPath): unknown =>
    field.segments.reduce<unknown>(
      (within, segment) =>
        (within as Record<string | number, unknown> | undefined)?.[segment],
      held,
    );

  const piecesOf = (value: string): string[] =>
    isExpression(value)
      ? [written(value)]
      : [...value.matchAll(PIECE)].map((found) => (found[1] ?? '').trim());

  it.each([
    ['a plain definition', LINEAR],
    ['a hinted definition', HINTED],
  ])('reach the same verdict on every expression in %s', (_, definition) => {
    const compiled = placesOf(definition);
    const warnings = compiled.warnings;
    const verdicts = new Map<string, string[]>();
    const shadowed = new Set<string>();

    for (const place of compiled.places.values()) {
      const value = valueAt(definition, place.field) as string;

      for (const piece of piecesOf(value)) {
        const check = checked(
          positionAt(place.field).rendered,
          piece,
          definition,
        );
        const key = place.field.rendered;

        verdicts.set(key, [
          ...(verdicts.get(key) ?? []),
          ...check.errors.map((each) => doubted(each.message, each.suggestion)),
        ]);

        for (const warning of check.warnings) {
          shadowed.add(`${warning.position.rendered}: ${warning.message}`);
        }
      }
    }

    const compiler = new Map<string, string[]>();
    for (const warning of warnings.filter((each) =>
      each.reason.startsWith('does not check'),
    )) {
      const key = warning.field.rendered;
      compiler.set(key, [...(compiler.get(key) ?? []), warning.reason]);
    }

    expect(compiler.size).toBeGreaterThan(0);
    expect(
      new Map([...verdicts].filter(([, each]) => each.length > 0)),
    ).toEqual(compiler);
    expect(shadowed).toEqual(
      new Set(
        warnings
          .filter((each) => each.reason.startsWith('shadows'))
          .map((each) => `${positionAt(each.field).rendered}: ${each.reason}`),
      ),
    );
  });
});

describe('the positions an expression is written at', () => {
  const listed = (written: string) =>
    checks.positions().find((each) => each.position.rendered === written);

  it('names what each sees, returns and also sees from the definition', () => {
    expect(listed('integration.webhook.events[*].when')).toEqual({
      position: expect.anything(),
      returns: 'bool',
      alsoSees: ['item'],
      sees: [
        { name: 'body', type: 'dyn', fields: [] },
        { name: 'headers', type: 'dyn', fields: [] },
        { name: 'raw', type: 'string', fields: [] },
      ],
    });
  });

  it('describes the fields Spotlight shapes', () => {
    expect(
      listed('integration.on[*].to[*]')?.sees.find(
        (each) => each.name === 'ask',
      ),
    ).toEqual({
      name: 'ask',
      type: 'object',
      fields: [
        { name: 'body', type: 'string', fields: [] },
        { name: 'link', type: 'dyn', fields: [] },
        { name: 'station', type: 'string', fields: [] },
      ],
    });
  });

  it('builds a position’s scope once, however often it is checked', () => {
    const [position] = EXPRESSION_POSITIONS;

    expect(position?.seen({})).toBe(position?.scope);
  });

  describe('against every expression an integration can hold', () => {
    const NOPE = e('nope');
    const FRESH = { at: NOPE, within: '300s' };
    const WEARS = { secrets: ['secret.KITCHEN_KEY'] };
    const VERIFIES = [
      { hmac: { secret: 'secret.SIGNING', signed: NOPE, freshness: FRESH } },
      {
        asymmetric: {
          algorithm: 'ed25519',
          key: NOPE,
          signed: NOPE,
          freshness: FRESH,
        },
      },
    ];

    const request = {
      url: NOPE,
      query: { k: NOPE },
      headers: { k: NOPE },
      body: NOPE,
      auth: WEARS,
      expect: { success: NOPE },
      capture: { k: NOPE },
    };

    const event = (happening: string) => ({
      forEach: NOPE,
      when: NOPE,
      lookup: { request, capture: { k: NOPE } },
      raise: {
        happening,
        say: NOPE,
        opens: {
          onto: 'core',
          title: NOPE,
          description: NOPE,
          assignBy: { email: NOPE },
        },
        branch: NOPE,
        marks: [{ kind: 'kitchen.mark', value: NOPE }],
        attaches: {
          each: NOPE,
          name: NOPE,
          type: NOPE,
          size: NOPE,
          fetch: request,
        },
      },
    });

    const holding = (verify: object) => ({
      integration: 'kitchen',
      connection: {
        oauth2: {
          authorize: 'https://kitchen.example.com/authorize',
          token: 'https://kitchen.example.com/token',
          identity: NOPE,
        },
      },
      webhook: {
        verify,
        respond: { when: NOPE, body: NOPE },
        mine: NOPE,
        route: { by: NOPE },
        delivery: NOPE,
        events: [event('kitchen.hooked')],
      },
      poll: {
        every: '60s',
        request,
        cursor: NOPE,
        events: [event('kitchen.polled')],
      },
      actions: { k: { request } },
      tools: {
        k: {
          does: 'k',
          description: 'Everything at once',
          inputs: { k: { default: NOPE } },
          output: NOPE,
        },
      },
      on: {
        'task.opened': {
          do: 'k',
          to: { k: NOPE },
          mark: [{ kind: 'kitchen.mark', value: NOPE }],
        },
      },
    });

    const reached = new Set(
      VERIFIES.flatMap((verify) => [
        ...placesOf(holding(verify)).places.values(),
      ]).map((place) => place.position.position.rendered),
    );

    it('lists every position an integration holds an expression at, and no other', () => {
      expect(reached).toEqual(
        new Set(EXPRESSION_POSITIONS.map((each) => each.position.rendered)),
      );
    });
  });
});
