import { Outlet, useParams } from 'react-router';
import { InboxRow } from '@/components/inbox/InboxRow';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { useInbox } from '@/hooks/api/useInbox';
import { useSidebarWidth } from '@/hooks/useSidebarWidth';
import { cn } from '@/lib/utils';

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
  const listPane = useSidebarWidth(LIST_PANE);

  if (isPending || !slug) {
    return null;
  }

  const items = waiting ?? [];
  const owed = items.filter((each) => !each.resolved);
  const done = items.filter((each) => each.resolved);

  return (
    <>
      <PageHeader title={<Breadcrumbs segments={[{ label: 'Inbox' }]} />} />

      <div
        className={cn(
          'flex min-h-0 flex-1',
          listPane.resizing && 'cursor-col-resize select-none',
        )}
      >
        <div
          style={{ width: listPane.width }}
          className="relative flex shrink-0 flex-col gap-0.5 overflow-y-auto overflow-x-hidden border-r-[0.5px] border-border p-2"
        >
          {items.length === 0 && (
            <p className="px-2 py-1 text-muted-foreground text-xs">
              Nothing is waiting on you.
            </p>
          )}

          {owed.map((item) => (
            <InboxRow key={item.taskId} slug={slug} item={item} />
          ))}

          {done.length > 0 && (
            <>
              {/* Answered and moved on. Kept because what was decided here is
                  worth going back to. */}
              <p className="px-2 pt-4 pb-1 font-medium text-muted-foreground text-xs">
                Resolved
              </p>

              {done.map((item) => (
                <InboxRow key={item.taskId} slug={slug} item={item} />
              ))}
            </>
          )}

          <div
            {...listPane.handleProps}
            className={cn(
              'absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize outline-none',
              'after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:opacity-0 after:transition-opacity',
              listPane.resizing && 'after:opacity-100',
            )}
          />
        </div>

        <Outlet />
      </div>
    </>
  );
}
