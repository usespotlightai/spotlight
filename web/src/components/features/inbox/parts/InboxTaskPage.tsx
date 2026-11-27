import { InboxDetailLayout } from '@/components/features/inbox/InboxDetailLayout';
import { InboxTaskParts } from '@/components/features/inbox/parts/InboxTaskParts';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import type { InboxItem } from '@/lib/inbox';

type InboxTaskPageProps = {
  slug: string;
  item: InboxItem;
  openAt: string | null;
  trail: readonly BreadcrumbSegment[];
};

export function InboxTaskPage({
  slug,
  item,
  openAt,
  trail,
}: InboxTaskPageProps) {
  return (
    <InboxDetailLayout trail={trail}>
      <h1 className="mb-6 font-medium text-foreground text-sm">{item.title}</h1>

      <InboxTaskParts slug={slug} item={item} openAt={openAt} />
    </InboxDetailLayout>
  );
}
