import type { LinePlan } from '@lines/domain/value-objects/line-plan.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import type { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';

export type CataloguedItem =
  | { readonly field: 'tools'; readonly item: Tool; readonly at: FieldPath }
  | {
      readonly field: 'skills';
      readonly item: SkillKey;
      readonly at: FieldPath;
    };

export interface ItemDenial {
  readonly id: string;
  readonly because: string;
}

export interface DeniedItem {
  readonly item: CataloguedItem;
  readonly because: string;
}

export const cataloguedIn = (plan: LinePlan): CataloguedItem[] =>
  plan.stations.flatMap((station, at): CataloguedItem[] => [
    ...station.tools.flatMap((item, index) =>
      item.origin === 'catalog'
        ? [
            {
              field: 'tools' as const,
              item,
              at: FieldPath.of(['stations', at, 'tools', index]),
            },
          ]
        : [],
    ),
    ...station.skills.flatMap((item, index) =>
      item.catalogued
        ? [
            {
              field: 'skills' as const,
              item,
              at: FieldPath.of(['stations', at, 'skills', index]),
            },
          ]
        : [],
    ),
  ]);

export const deniedIn = (
  items: readonly CataloguedItem[],
  denials: readonly ItemDenial[],
): DeniedItem[] =>
  denials.flatMap((denial) =>
    items
      .filter((each) => each.item.value === denial.id)
      .map((item) => ({ item, because: denial.because })),
  );
