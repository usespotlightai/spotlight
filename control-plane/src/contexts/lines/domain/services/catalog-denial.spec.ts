import {
  type CataloguedItem,
  deniedIn,
} from '@lines/domain/services/catalog-denial';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { describe, expect, it } from 'vitest';

const item = (
  id: string,
  field: CataloguedItem['field'],
  at: number,
): CataloguedItem =>
  field === 'tools'
    ? { field, item: Tool.of(id), at: FieldPath.of(['stations', 0, field, at]) }
    : {
        field,
        item: SkillKey.of(id),
        at: FieldPath.of(['stations', 0, field, at]),
      };

const TOOL = item('catalog.search', 'tools', 0);
const SKILL = item('catalog.research@1.0.0', 'skills', 0);
const OTHER = item('catalog.write@1.0.0', 'skills', 1);

describe('deniedIn', () => {
  it('denies a denied item where the line names it', () => {
    expect(
      deniedIn(
        [TOOL, OTHER],
        [
          {
            id: 'catalog.search',
            because: 'Catalog has no item catalog.search.',
          },
        ],
      ),
    ).toEqual([{ item: TOOL, because: 'Catalog has no item catalog.search.' }]);
  });

  it('denies a skill where the line names it, and not the items next to it', () => {
    expect(
      deniedIn(
        [SKILL, OTHER],
        [{ id: 'catalog.research@1.0.0', because: 'is a tool, not a skill' }],
      ),
    ).toEqual([{ item: SKILL, because: 'is a tool, not a skill' }]);
  });

  it('denies nothing when nothing is denied', () => {
    expect(deniedIn([TOOL, SKILL], [])).toEqual([]);
  });
});
