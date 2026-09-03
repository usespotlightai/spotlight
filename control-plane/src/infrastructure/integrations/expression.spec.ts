import {
  bound,
  compile,
  ExpressionError,
  holds,
  reads,
} from '@infrastructure/integrations/expression';
import { describe, expect, it } from 'vitest';

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

  // A file nobody can parse is a problem with the file, found when it is
  // read, rather than a delivery that fails at midnight.
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

  // A host sends every event it has, and most say nothing this asked about.
  // CEL throws on a missing key rather than reading it as absent, so a rule
  // written for one shape of delivery meets another and does not match.
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

  // CEL counts in bigints; a host that numbers something is still naming it.
  it('reads a number as the name it is', () => {
    expect(reads(compile('42'), delivery)).toBe('42');
  });

  it('reads nothing where the delivery names nothing', () => {
    expect(reads(compile('body.nothing'), delivery)).toBeNull();
    expect(reads(compile('""'), delivery)).toBeNull();
  });

  // A handle is one thing, not a structure. Reading an object as text would
  // put "[object Object]" where an identifier belongs.
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

  // The library refuses a reserved name itself. This makes it true of the
  // data too, so it stays true of whatever reads the delivery next.
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

  // CEL cannot loop, but it can walk a list, and the list comes from outside.
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
