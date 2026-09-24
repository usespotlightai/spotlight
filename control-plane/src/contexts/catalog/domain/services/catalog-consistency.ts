import type { CatalogItem } from '@catalog/domain/entities/catalog-item.entity';

export const catalogRefused = (
  items: readonly CatalogItem[],
): string | null => {
  for (const item of items) {
    if (items.filter((each) => each.id.equals(item.id)).length > 1) {
      return `lists ${item.id.value} twice`;
    }

    for (const brought of item.kind === 'skill' ? item.brings : []) {
      if (
        !items.some((each) => each.kind === 'tool' && each.id.equals(brought))
      ) {
        return `has the skill ${item.id.value} bring ${brought.value}, which it has no tool for`;
      }
    }
  }

  return null;
};
