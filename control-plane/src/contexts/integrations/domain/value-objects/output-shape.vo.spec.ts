import { OutputShape } from '@integrations/domain/value-objects/output-shape.vo';
import type { JsonValue } from '@shared-kernel/domain/services/json-value';
import { describe, expect, it } from 'vitest';

const ISSUE: JsonValue = {
  id: 'ENG-412',
  title: 'Queue drains slowly for alice@example.com',
  estimate: 3,
  done: false,
  assignee: null,
  labels: [{ name: 'bug' }, { name: 'p1', color: '#ff0000' }],
};

const nested = (depth: number): JsonValue =>
  depth === 0 ? 'bottom' : { deeper: nested(depth - 1) };

describe('OutputShape', () => {
  it('keeps field names and types, and none of the values', () => {
    const kept = JSON.stringify(OutputShape.of(ISSUE).toJson());

    for (const value of [
      'ENG-412',
      'alice@example.com',
      'Queue',
      'bug',
      'p1',
      '#ff0000',
    ]) {
      expect(kept).not.toContain(value);
    }
    expect(OutputShape.of(ISSUE).schema).toEqual({
      type: 'object',
      properties: {
        assignee: { type: 'null' },
        done: { type: 'boolean' },
        estimate: { type: 'number' },
        id: { type: 'string' },
        labels: {
          type: 'array',
          items: {
            type: 'object',
            properties: { color: { type: 'string' }, name: { type: 'string' } },
            required: ['name'],
            additionalProperties: false,
          },
        },
        title: { type: 'string' },
      },
      required: ['assignee', 'done', 'estimate', 'id', 'labels', 'title'],
      additionalProperties: false,
    });
  });

  it('reads an object keyed by data as a record, never keeping its keys', () => {
    const byEmail = {
      'alice@example.com': { seats: 2 },
      'bob@example.com': { seats: 1 },
    };
    const byId = { usr_10293: 'admin', usr_88231: 'member' };
    const byUuid = { e3b0c442a1fc: true };

    for (const keyed of [byEmail, byId, byUuid]) {
      const shape = OutputShape.of(keyed);

      expect(shape.node.kind).toBe('record');
      for (const key of Object.keys(keyed)) {
        expect(JSON.stringify(shape.toJson())).not.toContain(key);
      }
    }
  });

  it('reads an object with more fields than it keeps as a record', () => {
    const wide = Object.fromEntries(
      Array.from({ length: 41 }, (_, at) => [
        `field_${String.fromCharCode(97 + (at % 26))}${at > 25 ? 'x' : ''}`,
        at,
      ]),
    );

    expect(OutputShape.of(wide).node.kind).toBe('record');
  });

  it('stops reading at five levels deep', () => {
    expect(JSON.stringify(OutputShape.of(nested(10)).toJson())).toBe(
      JSON.stringify({
        kind: 'object',
        fields: [
          {
            name: 'deeper',
            shape: {
              kind: 'object',
              fields: [
                {
                  name: 'deeper',
                  shape: {
                    kind: 'object',
                    fields: [
                      {
                        name: 'deeper',
                        shape: {
                          kind: 'object',
                          fields: [
                            {
                              name: 'deeper',
                              shape: {
                                kind: 'object',
                                fields: [
                                  {
                                    name: 'deeper',
                                    shape: { kind: 'unknown' },
                                    optional: false,
                                  },
                                ],
                              },
                              optional: false,
                            },
                          ],
                        },
                        optional: false,
                      },
                    ],
                  },
                  optional: false,
                },
              ],
            },
            optional: false,
          },
        ],
      }),
    );
  });

  it('reads no more than 400 parts of an answer, however large', () => {
    const large = Array.from({ length: 500 }, (_, at) => ({
      [`f${String.fromCharCode(97 + (at % 26))}`]: Array.from(
        { length: 30 },
        () => ({ a: 1, b: [1, 2] }),
      ),
    }));
    const count = (held: unknown): number =>
      typeof held === 'object' && held !== null
        ? ('kind' in held ? 1 : 0) +
          Object.values(held).reduce<number>(
            (sum, each) => sum + count(each),
            0,
          )
        : 0;

    expect(count(OutputShape.of(large).toJson())).toBeLessThanOrEqual(400);
  });

  it('makes a field one answer leaves out optional when merged', () => {
    const merged = OutputShape.of({ id: 'a', url: 'b' }).mergedWith(
      OutputShape.of({ id: 'c' }),
    );

    expect(merged.schema).toMatchObject({
      properties: { id: { type: 'string' }, url: { type: 'string' } },
      required: ['id'],
    });
  });

  it('answers one of the shapes it saw, up to four, then anything', () => {
    const two = OutputShape.of({ at: 'x' }).mergedWith(
      OutputShape.of({ at: null }),
    );

    expect(two.schema).toMatchObject({
      properties: { at: { anyOf: [{ type: 'string' }, { type: 'null' }] } },
    });

    const five = [1, true, null, [1], { a: 1 }]
      .map((each) => OutputShape.of({ at: each as JsonValue }))
      .reduce((all, each) => all.mergedWith(each), OutputShape.of({ at: 'x' }));

    expect(five.schema).toMatchObject({ properties: { at: {} } });
  });

  it('merges the items of lists and the values of records', () => {
    const merged = OutputShape.of([{ a: 1 }]).mergedWith(
      OutputShape.of([{ a: 2, b: 'x' }]),
    );

    expect(merged.schema).toMatchObject({
      type: 'array',
      items: { required: ['a'], properties: { b: { type: 'string' } } },
    });
    expect(OutputShape.of([]).mergedWith(OutputShape.of(['x'])).schema).toEqual(
      {
        type: 'array',
        items: { type: 'string' },
      },
    );
  });

  it('reads an object as a record once a later answer brings mostly new keys', () => {
    const first = OutputShape.of({ alice: { seats: 2 }, bob: { seats: 1 } });
    const later = first.mergedWith(
      OutputShape.of({
        carol: { seats: 3 },
        dave: { seats: 1 },
        bob: { seats: 4 },
      }),
    );

    expect(later.node.kind).toBe('record');
    for (const name of ['alice', 'bob', 'carol', 'dave']) {
      expect(JSON.stringify(later.toJson())).not.toContain(name);
    }
    expect(
      OutputShape.of({ id: 'a', url: 'b' }).mergedWith(
        OutputShape.of({ id: 'c', url: 'd', title: 'e' }),
      ).node.kind,
    ).toBe('object');
  });

  it('is read back the way it was kept', () => {
    const shape = OutputShape.of(ISSUE);

    expect(
      OutputShape.kept(JSON.parse(JSON.stringify(shape.toJson()))).toJson(),
    ).toEqual(shape.toJson());
    expect(() => OutputShape.kept({ kind: 'nonsense' })).toThrow();
  });
});
