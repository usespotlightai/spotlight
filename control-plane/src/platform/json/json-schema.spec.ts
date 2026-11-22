import { JsonSchema } from '@platform/json/json-schema';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('JsonSchema', () => {
  it('describes its shape with every constraint its schema checks', () => {
    const schema = new JsonSchema(
      'score',
      z.object({ score: z.number().min(0).max(1) }),
    );

    expect(schema.json).toMatchObject({
      type: 'object',
      properties: { score: { type: 'number', minimum: 0, maximum: 1 } },
      required: ['score'],
      additionalProperties: false,
    });
  });

  it('checks the same input alike through its schema and its JSON Schema', () => {
    const schema = new JsonSchema(
      'score',
      z.object({ score: z.number().min(0).max(1) }),
    );
    const described = z.fromJSONSchema(schema.json);

    for (const input of [{ score: 0.5 }, { score: 2 }, { score: 'high' }]) {
      expect(described.safeParse(input).success).toBe(
        schema.schema.safeParse(input).success,
      );
    }
  });
});
