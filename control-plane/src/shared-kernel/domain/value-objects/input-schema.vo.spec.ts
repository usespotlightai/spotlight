import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
import { describe, expect, it } from 'vitest';

const FILTER = InputSchema.of({
  type: 'object',
  required: ['team'],
  additionalProperties: false,
  properties: {
    team: { type: 'string', minLength: 2 },
    state: {
      type: 'object',
      properties: { name: { type: 'string', enum: ['Todo', 'Done'] } },
    },
    labels: { type: 'array', items: { type: 'string' } },
    first: { type: 'integer', minimum: 1, maximum: 50 },
  },
});

const problem = (schema: InputSchema, value: unknown) => {
  const found = schema.problemWith(value);

  return found ? `${found.at.rendered} ${found.why}`.trim() : null;
};

describe('InputSchema', () => {
  it('keeps the keywords it knows and drops the rest', () => {
    expect(
      InputSchema.of({
        type: 'string',
        description: '  The issue  ',
        format: 'uuid',
        'x-vendor': true,
        discriminator: { propertyName: 'kind' },
        example: 'ENG-1',
      }).written,
    ).toEqual({
      type: 'string',
      description: 'The issue',
      examples: ['ENG-1'],
      format: 'uuid',
    });
  });

  it('reads anything that is not a schema as taking anything', () => {
    expect(InputSchema.of('string').written).toEqual({});
    expect(InputSchema.of(null).type).toBeNull();
  });

  it('merges allOf into one shape', () => {
    const merged = InputSchema.of({
      allOf: [
        { type: 'object', properties: { id: { type: 'string' } } },
        { required: ['id'], properties: { name: { type: 'string' } } },
      ],
    });

    expect(merged.written).toMatchObject({
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' }, name: { type: 'string' } },
    });
  });

  it('stops at a cycle, taking anything there', () => {
    const node: Record<string, unknown> = { type: 'object' };
    node.properties = { parent: node };

    expect(InputSchema.of(node).written).toEqual({
      type: 'object',
      properties: { parent: {} },
    });
  });

  it('stops eight levels deep', () => {
    let deepest: Record<string, unknown> = { type: 'string' };
    for (let level = 0; level < 12; level += 1) {
      deepest = { type: 'object', properties: { inner: deepest } };
    }

    const written = JSON.stringify(InputSchema.of(deepest).written);

    expect(written.match(/inner/g)).toHaveLength(8);
  });

  it('names the type a value is taken as', () => {
    expect(InputSchema.of({ type: ['string', 'null'] }).type).toBe('string');
    expect(InputSchema.of({ enum: [1, 2] }).type).toBe('number');
    expect(InputSchema.of({ enum: ['a', 1] }).type).toBeNull();
  });

  it('coerces text the way a command line hands it over', () => {
    expect(InputSchema.ofType('number').coerce(' 12 ')).toBe(12);
    expect(InputSchema.ofType('integer').coerce('twelve')).toBe('twelve');
    expect(InputSchema.ofType('boolean').coerce('false')).toBe(false);
    expect(InputSchema.ofType('string').coerce(12)).toBe('12');
    expect(FILTER.coerce('{"team":"ENG"}')).toEqual({ team: 'ENG' });
    expect(FILTER.coerce('{not json')).toBe('{not json');
    expect(InputSchema.ofType('number').coerce('0x10')).toBe('0x10');
    expect(InputSchema.ofType('number').coerce('-1.5e3')).toBe(-1500);
  });

  it('leaves a value that already fits as it is', () => {
    expect(InputSchema.of({ type: ['string', 'number'] }).coerce('12')).toBe(
      '12',
    );
    expect(InputSchema.of({ enum: ['true', 'false'] }).coerce('true')).toBe(
      'true',
    );
  });

  it('reads JSON text for a shape with no single type, where it fits', () => {
    const either = InputSchema.of({
      oneOf: [{ type: 'object' }, { type: 'array' }],
    });

    expect(InputSchema.of({}).coerce('{"a":1}')).toBe('{"a":1}');
    expect(either.coerce(' {"a":1}')).toEqual({ a: 1 });
    expect(either.coerce('[1]')).toEqual([1]);
    expect(InputSchema.of({ anyOf: [{ type: 'string' }] }).coerce('[1]')).toBe(
      '[1]',
    );
  });

  it('keeps a pattern without enforcing it', () => {
    const coded = InputSchema.of({ type: 'string', pattern: '^(a+)+$' });

    expect(coded.written.pattern).toBe('^(a+)+$');
    expect(coded.problemWith(`${'a'.repeat(40)}!`)).toBeNull();
  });

  it('rejects a value nested too deep to be JSON it reads', () => {
    let deep: unknown = 'x';
    for (let level = 0; level < 100; level += 1) {
      deep = [deep];
    }

    expect(InputSchema.of({}).problemWith(deep)).toEqual({
      at: expect.anything(),
      why: 'is not JSON',
    });
  });

  it('accepts a value of its shape', () => {
    expect(
      FILTER.problemWith({
        team: 'ENG',
        state: { name: 'Todo' },
        labels: ['bug'],
        first: 10,
      }),
    ).toBeNull();
  });

  it('says where, and why, a value is not of its shape', () => {
    expect(problem(FILTER, 'ENG')).toBe('is not an object');
    expect(problem(FILTER, {})).toBe('needs team');
    expect(problem(FILTER, { team: 'E' })).toBe(
      'team is shorter than 2 characters',
    );
    expect(problem(FILTER, { team: 'ENG', state: { name: 'Doing' } })).toBe(
      'state.name is not one of "Todo", "Done"',
    );
    expect(problem(FILTER, { team: 'ENG', labels: ['bug', 3] })).toBe(
      'labels[1] is not text',
    );
    expect(problem(FILTER, { team: 'ENG', first: 1.5 })).toBe(
      'first is not a whole number',
    );
    expect(problem(FILTER, { team: 'ENG', first: 51 })).toBe(
      'first is more than 50',
    );
    expect(problem(FILTER, { team: 'ENG', colour: 'red' })).toBe(
      'takes no colour',
    );
  });

  it('takes a value matching any one of its shapes', () => {
    const either = InputSchema.of({
      anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    });

    expect(either.problemWith(['a'])).toBeNull();
    expect(problem(either, 3)).toBe('is none of the shapes it may take');
  });

  it('allows null where its type lists it', () => {
    const nullable = InputSchema.of({ type: ['string', 'null'] });

    expect(nullable.problemWith(null)).toBeNull();
    expect(problem(nullable, 1)).toBe('is not text or null');
  });

  it('is equal to another of the same shape', () => {
    expect(
      InputSchema.of({ type: 'string', description: 'x' }).equals(
        InputSchema.of({ description: 'x', type: 'string' }),
      ),
    ).toBe(true);
  });
});
