import { JsonSchemaResultChecks } from '@assist/infrastructure/json/json-schema-result-checks';
import { describe, expect, it } from 'vitest';

const SCORE = {
  type: 'object',
  properties: {
    score: { type: 'number', minimum: 0, maximum: 1 },
    note: { type: 'string' },
  },
  required: ['score'],
  additionalProperties: false,
};

describe('JsonSchemaResultChecks', () => {
  const checks = new JsonSchemaResultChecks();

  it('takes a result that fits the JSON Schema', () => {
    expect(checks.check(SCORE, { score: 0.5, note: 'fine' })).toEqual({
      fits: true,
      result: { score: 0.5, note: 'fine' },
    });
  });

  it('names where a result breaks the schema, its bounds included', () => {
    const checked = checks.check(SCORE, { score: 2, extra: true });

    expect(checked.fits).toBe(false);
    expect(
      checked.fits ? [] : checked.issues.map((each) => each.path.join('.')),
    ).toEqual(expect.arrayContaining(['score']));
  });
});
