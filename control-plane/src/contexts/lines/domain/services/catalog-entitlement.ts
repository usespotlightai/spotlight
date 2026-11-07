import type { LinePlan } from '@lines/domain/value-objects/line-plan.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export type CataloguedField = 'tools' | 'skills';

export interface CataloguedItem {
  readonly id: string;
  readonly field: CataloguedField;
  readonly at: FieldPath;
}

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
  plan.stations.flatMap((station, at) => {
    const catalogued = {
      tools: station.tools
        .filter((each) => each.origin === 'catalog')
        .map((each) => each.value),
      skills: station.skills
        .filter((each) => each.catalogued)
        .map((each) => each.value),
    };

    return (['tools', 'skills'] as const).flatMap((field) =>
      [...station[field]].flatMap((each, index) =>
        catalogued[field].includes(each.value)
          ? [
              {
                id: each.value,
                field,
                at: FieldPath.of(['stations', at, field, index]),
              },
            ]
          : [],
      ),
    );
  });

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
      .filter((each) => denied.includes(each.id))
      .map((item) => ({ item, because: denial.because }));
  });
