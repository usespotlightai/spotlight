import type { Page } from '@/hooks/api/usePagedList';

export const everyPage = async <T>(
  read: (before: string | undefined) => Promise<Page<T>>,
): Promise<T[]> => {
  const items: T[] = [];
  let before: string | undefined;

  do {
    const page = await read(before);
    items.push(...page.items);
    before = page.next ?? undefined;
  } while (before);

  return items;
};
