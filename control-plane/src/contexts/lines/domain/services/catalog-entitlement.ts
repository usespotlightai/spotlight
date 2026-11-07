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

export interface Entitlement {
  readonly skills: readonly {
    readonly id: string;
    readonly tools: readonly string[];
  }[];
  readonly denied: readonly { readonly id: string; readonly because: string }[];
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
  entitlement: Entitlement,
): DeniedItem[] =>
  entitlement.denied.flatMap((denial) => {
    const denied = [
      denial.id,
      ...entitlement.skills
        .filter((skill) => skill.tools.includes(denial.id))
        .map((skill) => skill.id),
    ];

    return items
      .filter((each) => denied.includes(each.item.value))
      .map((item) => ({ item, because: denial.because }));
  });
