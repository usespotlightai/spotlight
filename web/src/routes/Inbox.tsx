import { Outlet, useParams } from 'react-router';
import { InboxRow } from '@/components/inbox/InboxRow';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { Disclosure } from '@/components/layout/Disclosure';
import { DisclosureRow } from '@/components/layout/DisclosureRow';
import { PageHeader } from '@/components/layout/PageHeader';
import { PaneHandle } from '@/components/layout/PaneHandle';
import { useInbox } from '@/hooks/api/useInbox';
import { useCollapsed } from '@/hooks/useCollapsed';
import { usePaneWidth } from '@/hooks/usePaneWidth';
import { cn } from '@/lib/utils';

const SECTIONS_STORAGE_KEY = 'spotlight.collapsed-inbox-sections';
const OPEN = 'open';
const RESOLVED = 'resolved';

const LIST_PANE = {
  storageKey: 'spotlight.inbox-width',
  min: 240,
  max: 520,
  initial: 340,
  label: 'Resize the inbox list',
};

export function Inbox() {
  const { slug } = useParams();
  const { data: waiting, isPending } = useInbox(slug);
  const listPane = usePaneWidth(LIST_PANE);
  const sections = useCollapsed(SECTIONS_STORAGE_KEY);

  if (isPending || !slug) {
    return null;
  }

  const items = waiting ?? [];
  const owed = items.filter((each) => !each.resolved);
  const done = items.filter((each) => each.resolved);

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1',
        listPane.resizing && 'cursor-col-resize select-none',
      )}
    >
      <div
        style={{ width: listPane.width }}
        className="relative flex shrink-0 flex-col border-r-[0.5px] border-border"
      >
        <PageHeader title={<Breadcrumbs segments={[{ label: 'Inbox' }]} />} />

        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden p-2">
          {items.length === 0 && (
            <p className="px-2 py-1 text-muted-foreground text-xs">
              Nothing is waiting on you.
            </p>
          )}

          {owed.length > 0 && (
            <div>
              <DisclosureRow
                label="Open"
                count={owed.length}
                open={sections.isExpanded(OPEN)}
                onToggle={() => sections.toggle(OPEN)}
                className="pl-2 font-medium text-xs"
              />

              <Disclosure open={sections.isExpanded(OPEN)}>
                {owed.map((item) => (
                  <li key={item.id}>
                    <InboxRow slug={slug} item={item} />
                  </li>
                ))}
              </Disclosure>
            </div>
          )}

          {done.length > 0 && (
            <div className={cn(owed.length > 0 && 'pt-4')}>
              <DisclosureRow
                label="Resolved"
                count={done.length}
                open={sections.isExpanded(RESOLVED)}
                onToggle={() => sections.toggle(RESOLVED)}
                className="pl-2 font-medium text-xs"
              />

              <Disclosure open={sections.isExpanded(RESOLVED)}>
                {done.map((item) => (
                  <li key={item.id}>
                    <InboxRow slug={slug} item={item} />
                  </li>
                ))}
              </Disclosure>
            </div>
          )}
        </div>

        <PaneHandle
          {...listPane.handleProps}
          edge="right"
          resizing={listPane.resizing}
        />
      </div>

      <Outlet />
    </div>
  );
}
