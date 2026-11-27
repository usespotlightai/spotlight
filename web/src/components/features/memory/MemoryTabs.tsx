import { TabLinks } from '@/components/shared/TabLinks';
import { type MemoryFilter, memoryListPath, STATUS_VIEWS } from '@/lib/memory';

type MemoryTabsProps = {
  slug: string;
  teamId: string;
  filter: MemoryFilter;
};

export function MemoryTabs({ slug, teamId, filter }: MemoryTabsProps) {
  return (
    <TabLinks
      label="Memory"
      current={filter.status}
      variant="underline"
      className="border-border border-b px-3"
      tabs={STATUS_VIEWS.map((view) => ({
        id: view.id,
        label: view.label,
        to: memoryListPath(slug, teamId, { ...filter, status: view.id }),
      }))}
    />
  );
}
