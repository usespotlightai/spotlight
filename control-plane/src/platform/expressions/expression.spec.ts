import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { sanitizedForCel } from '@platform/expressions/cel-variables';
import {
  ExpressionError,
  ExpressionFailedError,
} from '@platform/expressions/expression.errors';
import {
  evaluateText,
  isTrue,
  required,
  requiredText,
} from '@platform/expressions/readings';
import { Scope } from '@platform/expressions/scope';
import { describe, expect, it } from 'vitest';

const expressions = new CelExpressionEngine();
const compile = expressions.compile.bind(expressions);

const payload = {
  body: sanitizedForCel({
    type: 'Issue',
    action: 'update',
    data: { identifier: 'ENG-42', state: { name: 'Done' }, labels: ['bug'] },
  }),
  headers: sanitizedForCel({ 'linear-delivery': 'd_1' }),
};

describe('compiling an expression', () => {
  it('parses it once, and evaluates it against a payload', () => {
    expect(compile('body.data.identifier').evaluate(payload)).toBe('ENG-42');
  });

  it('rejects one that will not parse', () => {
    expect(() => compile('body.data. ==')).toThrow(ExpressionError);
    expect(() => compile('   ')).toThrow(/is empty/);
  });

  it('rejects one longer than anybody would write', () => {
    expect(() => compile(`"${'a'.repeat(2_100)}"`)).toThrow(/longer than/);
  });

  it('carries the reason it would not parse', () => {
    expect(() => compile('body.data. ==')).toThrow(/body\.data/);
  });
});

describe('whether an expression is true', () => {
  it('is true only where it is plainly true', () => {
    expect(isTrue(compile('body.type == "Issue"'), payload)).toBe(true);
    expect(isTrue(compile('body.type == "Comment"'), payload)).toBe(false);
  });

  it('reads a nested value the way a person would write it', () => {
    expect(isTrue(compile('body.data.state.name == "Done"'), payload)).toBe(
      true,
    );
  });

  it('is true where every part of it is true', () => {
    expect(
      isTrue(
        compile('body.type == "Issue" && body.data.state.name == "Done"'),
        payload,
      ),
    ).toBe(true);
  });

  it('is not true where the payload has no such field', () => {
    expect(
      isTrue(compile('body.data.state.name == "Done"'), {
        body: sanitizedForCel({ type: 'Comment' }),
      }),
    ).toBe(false);
    expect(isTrue(compile('nothing.at.all'), payload)).toBe(false);
  });

  it('lets a person check whether a field is there at all', () => {
    expect(isTrue(compile('has(body.data)'), payload)).toBe(true);
    expect(isTrue(compile('has(body.nothing)'), payload)).toBe(false);
  });

  it('is false for anything that is not a boolean', () => {
    expect(isTrue(compile('body.type'), payload)).toBe(false);
    expect(isTrue(compile('1'), payload)).toBe(false);
  });
});

describe('what an expression evaluates to as text', () => {
  it('reads text as it is', () => {
    expect(evaluateText(compile('body.data.identifier'), payload)).toBe(
      'ENG-42',
    );
  });

  it('reads a header the service set', () => {
    expect(evaluateText(compile('headers["linear-delivery"]'), payload)).toBe(
      'd_1',
    );
  });

  it('reads a number as the name it is', () => {
    expect(evaluateText(compile('42'), payload)).toBe('42');
  });

  it('reads nothing where the payload names nothing', () => {
    expect(evaluateText(compile('body.nothing'), payload)).toBeNull();
    expect(evaluateText(compile('""'), payload)).toBeNull();
  });

  it('reads nothing where the value is not a single thing', () => {
    expect(evaluateText(compile('body.data'), payload)).toBeNull();
    expect(evaluateText(compile('body.data.labels'), payload)).toBeNull();
  });
});

describe('sanitizing a payload for CEL', () => {
  it('keeps what an expression is meant to read', () => {
    const value = sanitizedForCel({ a: 1, b: { c: 'x' }, d: [1, 2] }) as Record<
      string,
      unknown
    >;

    expect(value.a).toBe(1);
    expect(value.d).toEqual([1, 2]);
    expect((value.b as Record<string, unknown>).c).toBe('x');
  });

  it('drops the names that go past a plain object', () => {
    const value = sanitizedForCel(
      JSON.parse('{"__proto__":{"polluted":true},"ok":1}'),
    ) as Record<string, unknown>;

    expect(value.ok).toBe(1);
    expect(Object.keys(value)).toEqual(['ok']);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('leaves objects inheriting nothing at all', () => {
    expect(Object.getPrototypeOf(sanitizedForCel({ a: 1 }))).toBeNull();
  });

  it('rejects a payload nested deeper than anyone would read', () => {
    let deep: Record<string, unknown> = { end: true };
    for (let at = 0; at < 40; at += 1) {
      deep = { deep };
    }

    expect(() => sanitizedForCel(deep)).toThrow(/nested deeper/);
  });

  it('rejects a list longer than anyone would walk', () => {
    expect(() => sanitizedForCel({ many: new Array(600).fill(1) })).toThrow(
      /longer list/,
    );
  });

  it('rejects a payload that has more than can be read', () => {
    const wide = Object.fromEntries(
      new Array(400).fill(0).map((_, at) => [`k${at}`, new Array(400).fill(1)]),
    );

    expect(() => sanitizedForCel(wide)).toThrow(/more than can be read/);
  });
});

describe('checking an expression against what it may read', () => {
  const scope = Scope.of({
    body: 'dyn',
    task: { schema: { line: 'string', marks: 'map<string, string>' } },
  });
  const reason = (source: string) => {
    const checked = expressions.check(source, scope);

    return checked.valid ? null : checked.reason;
  };

  it('finds nothing wrong with one that reads only what is there', () => {
    expect(reason('task.marks["linear.issue"]')).toBeNull();
    expect(reason('body.anything.at.all')).toBeNull();
  });

  it('rejects one that misspells a field Spotlight shapes', () => {
    expect(reason('task.lnie')).toMatch(/No such key: lnie/);
  });

  it('rejects one that names something not there at all', () => {
    expect(reason('tsak.line')).toMatch(/Unknown variable: tsak/);
  });

  it('rejects one that could never evaluate', () => {
    expect(reason('task.line + 1')).toMatch(/no such overload/);
  });

  it('rejects one longer than anybody would write', () => {
    expect(reason(`"${'a'.repeat(2_100)}"`)).toMatch(/longer than/);
  });

  it('still compiles one it rejects, to read the way it always read', () => {
    expect(
      evaluateText(compile('ask.body'), {
        ask: { body: 'The queue is stuck.' },
      }),
    ).toBe('The queue is stuck.');
  });

  it('reads a map that mixes what it contains', () => {
    const source = '{"channel": body.channel, "text": "Got it."}';

    expect(reason(source)).toBeNull();
    expect(
      compile(source).evaluate({ body: sanitizedForCel({ channel: 'C1' }) }),
    ).toEqual({ channel: 'C1', text: 'Got it.' });
  });

  it('remembers where in the file it is written', () => {
    expect(compile('body.x', { location: 'actions.post.body' }).location).toBe(
      'actions.post.body',
    );
    expect(compile('body.x').location).toBeNull();
  });
});

describe('suggesting what a misspelling meant', () => {
  const scope = Scope.of({
    event: { schema: { arguments: { issue: 'string' }, name: 'string' } },
    task: { schema: { line: 'string', stationKey: 'string' } },
    issue: 'Issue',
  }).typed([['Issue', { identifier: 'string', state: { name: 'string' } }]]);
  const suggestion = (source: string) => {
    const checked = expressions.check(source, scope);

    return checked.valid ? undefined : checked.suggestion;
  };

  it('suggests the declared name nearest a misspelt one', () => {
    expect(suggestion('tsak.line')).toBe('task');
  });

  it('suggests the field nearest a misspelt one, with the way to it', () => {
    expect(suggestion('event.argumnts')).toBe('event.arguments');
    expect(suggestion('event.arguments.isue')).toBe('event.arguments.issue');
    expect(suggestion('task.stationkey == "x"')).toBe('task.stationKey');
  });

  it('follows a field into the type it names', () => {
    expect(suggestion('issue.state.nmae')).toBe('issue.state.name');
  });

  it('suggests nothing where nothing declared is near', () => {
    expect(suggestion('whatever.line')).toBeNull();
    expect(suggestion('task.somethingelse')).toBeNull();
    expect(suggestion('task.line + 1')).toBeNull();
  });
});

describe('what a call cannot be made without', () => {
  const location = 'actions.post-message.request.body';

  it('is what the expression evaluates to', () => {
    expect(required(compile('body.type', { location }), payload)).toBe('Issue');
    expect(requiredText(compile('body.data.identifier'), payload)).toBe(
      'ENG-42',
    );
  });

  it('throws, naming where it is written, where it cannot be read', () => {
    const failing = () =>
      required(compile('body.data.missing', { location }), payload);

    expect(failing).toThrow(ExpressionFailedError);
    expect(failing).toThrow(`${location}: No such key: missing`);
  });

  it('is nothing, not a failure, where it plainly reads as nothing', () => {
    expect(requiredText(compile('""'), payload)).toBeNull();
    expect(requiredText(compile('body.data'), payload)).toBeNull();
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
    expect(checked.valid ? null : checked.span).toEqual({ start: 5, end: 9 });
    expect(checked.valid ? null : checked.suggestion).toBe('task.line');
  });

  it('rejects one that will not parse', () => {
    expect(expressions.check('task. ==', scope)).toMatchObject({
      valid: false,
    });
  });
});
