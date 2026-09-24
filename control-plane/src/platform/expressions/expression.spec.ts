import { bound } from '@platform/expressions/bindings';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import {
  ExpressionError,
  ExpressionFailedError,
} from '@platform/expressions/expression.errors';
import {
  holds,
  reads,
  required,
  requiredText,
} from '@platform/expressions/readings';
import { Scope } from '@platform/expressions/scope';
import { describe, expect, it } from 'vitest';

const expressions = new CelExpressionEngine();
const compile = expressions.compile.bind(expressions);

const delivery = {
  body: bound({
    type: 'Issue',
    action: 'update',
    data: { identifier: 'ENG-42', state: { name: 'Done' }, labels: ['bug'] },
  }),
  headers: bound({ 'linear-delivery': 'd_1' }),
};

describe('compiling an expression', () => {
  it('parses it once, and evaluates it against a delivery', () => {
    expect(compile('body.data.identifier').evaluate(delivery)).toBe('ENG-42');
  });

  it('refuses one that will not parse', () => {
    expect(() => compile('body.data. ==')).toThrow(ExpressionError);
    expect(() => compile('   ')).toThrow(/is empty/);
  });

  it('refuses one longer than anybody would write', () => {
    expect(() => compile(`"${'a'.repeat(2_100)}"`)).toThrow(/longer than/);
  });

  it('carries the reason it would not parse', () => {
    expect(() => compile('body.data. ==')).toThrow(/body\.data/);
  });
});

describe('whether an expression holds', () => {
  it('is true only where it is plainly true', () => {
    expect(holds(compile('body.type == "Issue"'), delivery)).toBe(true);
    expect(holds(compile('body.type == "Comment"'), delivery)).toBe(false);
  });

  it('reads a nested value the way a person would write it', () => {
    expect(holds(compile('body.data.state.name == "Done"'), delivery)).toBe(
      true,
    );
  });

  it('holds where every part of it does', () => {
    expect(
      holds(
        compile('body.type == "Issue" && body.data.state.name == "Done"'),
        delivery,
      ),
    ).toBe(true);
  });

  it('does not hold where the delivery has no such field', () => {
    expect(
      holds(compile('body.data.state.name == "Done"'), {
        body: bound({ type: 'Comment' }),
      }),
    ).toBe(false);
    expect(holds(compile('nothing.at.all'), delivery)).toBe(false);
  });

  it('lets a person ask whether a field is there at all', () => {
    expect(holds(compile('has(body.data)'), delivery)).toBe(true);
    expect(holds(compile('has(body.nothing)'), delivery)).toBe(false);
  });

  it('is false for anything that is not a boolean', () => {
    expect(holds(compile('body.type'), delivery)).toBe(false);
    expect(holds(compile('1'), delivery)).toBe(false);
  });
});

describe('what an expression reads', () => {
  it('reads text as it stands', () => {
    expect(reads(compile('body.data.identifier'), delivery)).toBe('ENG-42');
  });

  it('reads a header the host set', () => {
    expect(reads(compile('headers["linear-delivery"]'), delivery)).toBe('d_1');
  });

  it('reads a number as the name it is', () => {
    expect(reads(compile('42'), delivery)).toBe('42');
  });

  it('reads nothing where the delivery names nothing', () => {
    expect(reads(compile('body.nothing'), delivery)).toBeNull();
    expect(reads(compile('""'), delivery)).toBeNull();
  });

  it('reads nothing where the value is not a single thing', () => {
    expect(reads(compile('body.data'), delivery)).toBeNull();
    expect(reads(compile('body.data.labels'), delivery)).toBeNull();
  });
});

describe('binding a delivery', () => {
  it('keeps what an expression is meant to read', () => {
    const held = bound({ a: 1, b: { c: 'x' }, d: [1, 2] }) as Record<
      string,
      unknown
    >;

    expect(held.a).toBe(1);
    expect(held.d).toEqual([1, 2]);
    expect((held.b as Record<string, unknown>).c).toBe('x');
  });

  it('drops the names that reach past a plain object', () => {
    const held = bound(
      JSON.parse('{"__proto__":{"polluted":true},"ok":1}'),
    ) as Record<string, unknown>;

    expect(held.ok).toBe(1);
    expect(Object.keys(held)).toEqual(['ok']);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('leaves objects inheriting nothing at all', () => {
    expect(Object.getPrototypeOf(bound({ a: 1 }))).toBeNull();
  });

  it('refuses a delivery nested deeper than anyone would read', () => {
    let deep: Record<string, unknown> = { end: true };
    for (let at = 0; at < 40; at += 1) {
      deep = { deep };
    }

    expect(() => bound(deep)).toThrow(/nested deeper/);
  });

  it('refuses a list longer than anyone would walk', () => {
    expect(() => bound({ many: new Array(600).fill(1) })).toThrow(
      /longer list/,
    );
  });

  it('refuses a delivery holding more than can be read', () => {
    const wide = Object.fromEntries(
      new Array(400).fill(0).map((_, at) => [`k${at}`, new Array(400).fill(1)]),
    );

    expect(() => bound(wide)).toThrow(/more than can be read/);
  });
});

describe('checking an expression against what it may read', () => {
  const scope = Scope.of({
    body: 'dyn',
    task: { schema: { line: 'string', marks: 'map<string, string>' } },
  });

  it('has no doubt about one that reads only what is there', () => {
    expect(compile('task.marks["linear.issue"]', { scope }).doubt).toBeNull();
    expect(compile('body.anything.at.all', { scope }).doubt).toBeNull();
  });

  it('doubts one that misspells a field Spotlight shapes', () => {
    expect(compile('task.lnie', { scope }).doubt).toMatch(/No such key: lnie/);
  });

  it('doubts one that names something not there at all', () => {
    expect(compile('tsak.line', { scope }).doubt).toMatch(
      /Unknown variable: tsak/,
    );
  });

  it('doubts one that could never evaluate', () => {
    expect(compile('task.line + 1', { scope }).doubt).toMatch(
      /no such overload/,
    );
  });

  it('still reads one it doubts, the way it always read', () => {
    const doubted = compile('ask.body', { scope });

    expect(doubted.doubt).not.toBeNull();
    expect(reads(doubted, { ask: { body: 'The queue is stuck.' } })).toBe(
      'The queue is stuck.',
    );
  });

  it('reads a map that mixes what it holds', () => {
    const mixed = compile('{"channel": body.channel, "text": "Got it."}', {
      scope,
    });

    expect(mixed.doubt).toBeNull();
    expect(mixed.evaluate({ body: bound({ channel: 'C1' }) })).toEqual({
      channel: 'C1',
      text: 'Got it.',
    });
  });

  it('remembers where in the file it is written', () => {
    expect(compile('body.x', { scope, at: 'actions.post.body' }).at).toBe(
      'actions.post.body',
    );
    expect(compile('body.x').at).toBeNull();
  });
});

describe('what a call cannot be made without', () => {
  const at = 'actions.post-message.request.body';

  it('is what the expression evaluates to', () => {
    expect(required(compile('body.type', { at }), delivery)).toBe('Issue');
    expect(requiredText(compile('body.data.identifier'), delivery)).toBe(
      'ENG-42',
    );
  });

  it('throws, naming where it is written, where it cannot be read', () => {
    const failing = () =>
      required(compile('body.data.missing', { at }), delivery);

    expect(failing).toThrow(ExpressionFailedError);
    expect(failing).toThrow(`${at}: No such key: missing`);
  });

  it('is nothing, not a failure, where it plainly reads as nothing', () => {
    expect(requiredText(compile('""'), delivery)).toBeNull();
    expect(requiredText(compile('body.data'), delivery)).toBeNull();
  });
});

describe('checking an expression without compiling it', () => {
  const scope = Scope.of({
    task: { schema: { line: 'string', marks: 'map<string, string>' } },
  });

  it('names the type a sound one evaluates to', () => {
    expect(expressions.check('task.line == "core"', scope)).toEqual({
      valid: true,
      type: 'bool',
    });
    expect(expressions.check('task.marks["linear.issue"]', scope)).toEqual({
      valid: true,
      type: 'string',
    });
  });

  it('says why one does not check, and where in it', () => {
    const checked = expressions.check('task.lnie', scope);

    expect(checked).toMatchObject({ valid: false });
    expect(checked.valid ? null : checked.reason).toMatch(/No such key: lnie/);
    expect(checked.valid ? null : checked.span).toEqual({
      start: expect.any(Number),
      end: expect.any(Number),
    });
  });

  it('refuses one that will not parse', () => {
    expect(expressions.check('task. ==', scope)).toMatchObject({
      valid: false,
    });
  });
});
