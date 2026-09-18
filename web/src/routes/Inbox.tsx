import { Outlet, useParams } from 'react-router';
import { InboxListSkeleton } from '@/components/features/inbox/InboxListSkeleton';
import { InboxRow } from '@/components/features/inbox/InboxRow';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { Disclosure } from '@/components/shell/layout/Disclosure';
import { DisclosureRow } from '@/components/shell/layout/DisclosureRow';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { PaneHandle } from '@/components/shell/layout/PaneHandle';
import { useInbox } from '@/hooks/api/useInbox';
import { useCollapsed } from '@/hooks/useCollapsed';
import { usePaneWidth } from '@/hooks/usePaneWidth';
import { inboxPath } from '@/lib/inbox';
import { loading } from '@/lib/query';
import { TrailContext } from '@/lib/trail';
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
  const inbox = useInbox(slug);
  const listPane = usePaneWidth<HTMLDivElement>(LIST_PANE);
  const sections = useCollapsed(SECTIONS_STORAGE_KEY);

  if (!slug) {
    return null;
  }

  const items = inbox.data ?? [];
  const owed = items.filter((each) => !each.resolved);
  const done = items.filter((each) => each.resolved);

  return (
    <TrailContext value={[{ label: 'Inbox', to: inboxPath(slug) }]}>
      <div
        className={cn(
          'flex min-h-0 flex-1',
          listPane.resizing && 'cursor-col-resize select-none',
        )}
      >
        <div
          ref={listPane.paneRef}
          style={{ width: listPane.width }}
          className="relative flex shrink-0 flex-col border-r-[0.5px] border-border"
        >
          <PageHeader title={<Breadcrumbs segments={[{ label: 'Inbox' }]} />} />

          <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden p-2">
            {loading(inbox) && (
              <InboxListSkeleton
                open={sections.isExpanded(OPEN)}
                onToggle={() => sections.toggle(OPEN)}
              />
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
    </TrailContext>
  );
}
