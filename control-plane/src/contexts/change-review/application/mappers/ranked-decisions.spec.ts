import type { DecisionDto } from '@change-review/application/dto/decision.dto';
import { ranked } from '@change-review/application/mappers/ranked-decisions';
import { describe, expect, it } from 'vitest';

const decision = (id: string, kind: DecisionDto['kind']): DecisionDto => ({
  id,
  kind,
  title: id,
  why: 'Because.',
  alternatives: [],
  paths: ['api/src/uploads.ts'],
  steps: [3],
  disputes: [],
});

describe('ranking decisions for a reviewer', () => {
  it('puts deviations and limitations first, keeping the drafted order within a kind', () => {
    expect(
      ranked([
        decision('simple', 'trade-off'),
        decision('once', 'limitation'),
        decision('banner', 'deviation'),
        decision('twice', 'limitation'),
      ]).map((each) => each.id),
    ).toEqual(['banner', 'once', 'twice', 'simple']);
  });
});
