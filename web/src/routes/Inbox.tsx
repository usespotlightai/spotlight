import { DndContext } from '@dnd-kit/core';
import { useParams } from 'react-router';
import { DraggableInboxEntry } from '@/components/features/inbox/DraggableInboxEntry';
import { InboxDragOverlay } from '@/components/features/inbox/InboxDragOverlay';
import { InboxDropZone } from '@/components/features/inbox/InboxDropZone';
import { InboxListSkeleton } from '@/components/features/inbox/InboxListSkeleton';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import {
  DISCLOSURE_MS,
  Disclosure,
} from '@/components/shell/layout/Disclosure';
import { DisclosureRow } from '@/components/shell/layout/DisclosureRow';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { PageOutlet } from '@/components/shell/layout/PageOutlet';
import { PaneHandle } from '@/components/shell/layout/PaneHandle';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useInbox } from '@/hooks/api/useInbox';
import { useCollapsed } from '@/hooks/useCollapsed';
import { OPEN_DROP, RESOLVED_DROP, useInboxDrag } from '@/hooks/useInboxDrag';
import { usePaneWidth } from '@/hooks/usePaneWidth';
import { useTimedFlag } from '@/hooks/useTimedFlag';
import { entryKey, inboxPath } from '@/lib/inbox';
import { loading } from '@/lib/query';
import { TrailContext } from '@/lib/trail';
import { cn } from '@/lib/utils';

const SECTIONS_STORAGE_KEY = 'spotlight.inbox-collapsed-sections';
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
  const {
    width: listWidth,
    resizing: listResizing,
    paneRef: listRef,
    handleProps: listHandle,
  } = usePaneWidth<HTMLDivElement>(LIST_PANE);
  const sections = useCollapsed(SECTIONS_STORAGE_KEY, [RESOLVED]);
  const animating = useTimedFlag(DISCLOSURE_MS);
  const toggle = (section: string) => {
    animating.raise();
    sections.toggle(section);
  };
  const entries = inbox.data ?? [];
  const drag = useInboxDrag(slug, entries);

  if (!slug) {
    return null;
  }

  const unresolved = entries.filter((each) => !each.resolved);
  const done = entries.filter((each) => each.resolved);

  return (
    <TrailContext value={[{ label: 'Inbox', to: inboxPath(slug) }]}>
      <div
        className={cn(
          'flex min-h-0 flex-1',
          listResizing && 'cursor-col-resize select-none',
        )}
      >
        <div
          ref={listRef}
          style={{ width: listWidth }}
          className="relative flex shrink-0 flex-col border-r-[0.5px] border-border"
        >
          <PageHeader title={<Breadcrumbs segments={[{ label: 'Inbox' }]} />} />

          <DndContext sensors={drag.sensors} {...drag.handlers}>
            <ScrollArea
              className="min-h-0 flex-1"
              scrollbar={animating.on ? 'hidden' : 'while-scrolling'}
              contentClassName="min-h-full flex flex-col gap-0.5 p-2"
            >
              {loading(inbox) && (
                <InboxListSkeleton
                  open={sections.isExpanded(OPEN)}
                  onToggleOpen={() => toggle(OPEN)}
                  resolved={sections.isExpanded(RESOLVED)}
                  onToggleResolved={() => toggle(RESOLVED)}
                />
              )}

              {inbox.data && (
                <InboxDropZone id={OPEN_DROP}>
                  <DisclosureRow
                    label="Open"
                    count={unresolved.length}
                    open={sections.isExpanded(OPEN)}
                    onToggle={() => toggle(OPEN)}
                    className="pl-2 font-medium text-xs"
                  />

                  <Disclosure open={sections.isExpanded(OPEN)}>
                    {unresolved.map((entry) => (
                      <DraggableInboxEntry
                        key={entryKey(entry)}
                        slug={slug}
                        entry={entry}
                      />
                    ))}
                  </Disclosure>
                </InboxDropZone>
              )}

              {inbox.data && (
                <div className="mt-auto pt-4">
                  <InboxDropZone id={RESOLVED_DROP}>
                    <DisclosureRow
                      label="Resolved"
                      count={done.length}
                      open={sections.isExpanded(RESOLVED)}
                      onToggle={() => toggle(RESOLVED)}
                      className="pl-2 font-medium text-xs"
                    />

                    <Disclosure open={sections.isExpanded(RESOLVED)}>
                      {done.map((entry) => (
                        <DraggableInboxEntry
                          key={entryKey(entry)}
                          slug={slug}
                          entry={entry}
                        />
                      ))}
                    </Disclosure>
                  </InboxDropZone>
                </div>
              )}
            </ScrollArea>

            <InboxDragOverlay slug={slug} entry={drag.dragged} />
          </DndContext>

          <PaneHandle {...listHandle} edge="right" resizing={listResizing} />
        </div>

        <PageOutlet />
      </div>
    </TrailContext>
  );
}
