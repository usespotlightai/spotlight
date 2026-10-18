import type { CatalogItem } from '@catalog/domain/entities/catalog-item.entity';

export const catalogProblem = (
  items: readonly CatalogItem[],
): string | null => {
  for (const item of items) {
    if (items.filter((each) => each.id.equals(item.id)).length > 1) {
      return `lists ${item.id.value} twice`;
    }

    for (const toolId of item.kind === 'skill' ? item.tools : []) {
      if (
        !items.some((each) => each.kind === 'tool' && each.id.equals(toolId))
      ) {
        return `has the skill ${item.id.value} use ${toolId.value}, which it has no tool for`;
      }
    }
  }

  return null;
};
