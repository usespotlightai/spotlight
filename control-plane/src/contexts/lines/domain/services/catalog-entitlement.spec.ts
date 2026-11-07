import {
  type CataloguedItem,
  deniedIn,
} from '@lines/domain/services/catalog-entitlement';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { describe, expect, it } from 'vitest';

const item = (
  id: string,
  field: CataloguedItem['field'],
  at: number,
): CataloguedItem => ({
  id,
  field,
  at: FieldPath.of(['stations', 0, field, at]),
});

const TOOL = item('catalog.search', 'tools', 0);
const SKILL = item('catalog.research', 'skills', 0);
const OTHER = item('catalog.write', 'skills', 1);

describe('deniedIn', () => {
  it('denies a denied item where the plan names it', () => {
    expect(
      deniedIn([TOOL, OTHER], {
        skills: [],
        denied: [{ id: 'catalog.search', because: 'is not in your plan' }],
      }),
    ).toEqual([{ item: TOOL, because: 'is not in your plan' }]);
  });

  it('denies a skill that brings a denied tool, for the same reason', () => {
    expect(
      deniedIn([SKILL, OTHER], {
        skills: [
          { id: 'catalog.research', tools: ['catalog.search'] },
          { id: 'catalog.write', tools: [] },
        ],
        denied: [{ id: 'catalog.search', because: 'has expired' }],
      }),
    ).toEqual([{ item: SKILL, because: 'has expired' }]);
  });

  it('denies nothing when nothing is denied', () => {
    expect(
      deniedIn([TOOL, SKILL], {
        skills: [{ id: 'catalog.research', tools: ['catalog.search'] }],
        denied: [],
      }),
    ).toEqual([]);
  });
});
