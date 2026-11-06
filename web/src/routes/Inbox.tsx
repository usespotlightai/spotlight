import { DndContext } from '@dnd-kit/core';
import { useParams } from 'react-router';
import { InboxDragOverlay } from '@/components/features/inbox/InboxDragOverlay';
import { InboxDropZone } from '@/components/features/inbox/InboxDropZone';
import { InboxListSkeleton } from '@/components/features/inbox/InboxListSkeleton';
import { InboxRowSkeleton } from '@/components/features/inbox/InboxRowSkeleton';
import { InboxSection } from '@/components/features/inbox/InboxSection';
import { FileDropZone } from '@/components/shared/attachment/FileDropZone';
import { ShowMore } from '@/components/shared/ShowMore';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { DISCLOSURE_MS } from '@/components/shell/layout/Disclosure';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { PageOutlet } from '@/components/shell/layout/PageOutlet';
import { PaneHandle } from '@/components/shell/layout/PaneHandle';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useInbox, useResolvedInbox } from '@/hooks/api/useInbox';
import { useCollapsed } from '@/hooks/useCollapsed';
import { OPEN_DROP, RESOLVED_DROP, useInboxDrag } from '@/hooks/useInboxDrag';
import { usePaneWidth } from '@/hooks/usePaneWidth';
import { useTimedFlag } from '@/hooks/useTimedFlag';
import { entryKey, inboxPath, sectionOf } from '@/lib/inbox';
import { loading } from '@/lib/query';
import { TrailContext } from '@/lib/trail';
import { cn } from '@/lib/utils';

const SECTIONS_STORAGE_KEY = 'spotlight.inbox-sections-collapsed';
const OPEN = 'open';
const RUNNING = 'running';
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
  const sections = useCollapsed(SECTIONS_STORAGE_KEY, [RUNNING, RESOLVED]);
  const animating = useTimedFlag(DISCLOSURE_MS);
  const toggle = (section: string) => {
    animating.raise();
    sections.toggle(section);
  };
  const section = (id: string) => ({
    open: sections.isExpanded(id),
    onToggle: () => toggle(id),
  });
  const resolvedInbox = useResolvedInbox(slug, sections.isExpanded(RESOLVED));
  const open = inbox.data ?? [];
  const opened = new Set(open.map(entryKey));
  const entries = [
    ...open,
    ...(resolvedInbox.data ?? []).filter((each) => !opened.has(entryKey(each))),
  ];
  const drag = useInboxDrag(slug, entries);

  if (!slug) {
    return null;
  }

  const waiting = entries.filter((each) => sectionOf(each) === OPEN);
  const working = entries.filter((each) => sectionOf(each) === RUNNING);
  const done = entries.filter((each) => sectionOf(each) === RESOLVED);

  return (
    <TrailContext value={[{ label: 'Inbox', to: inboxPath(slug) }]}>
      <FileDropZone className="flex min-h-0 flex-1 flex-col rounded-lg">
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
            <PageHeader
              title={<Breadcrumbs segments={[{ label: 'Inbox' }]} />}
            />

            <DndContext sensors={drag.sensors} {...drag.handlers}>
              <ScrollArea
                className="min-h-0 flex-1"
                scrollbar={animating.on ? 'hidden' : 'while-scrolling'}
                contentClassName="min-h-full flex flex-col gap-0.5 p-2"
              >
                {loading(inbox) && (
                  <InboxListSkeleton
                    open={section(OPEN)}
                    running={section(RUNNING)}
                    resolved={section(RESOLVED)}
                  />
                )}

                {inbox.data && (
                  <InboxDropZone id={OPEN_DROP}>
                    <InboxSection
                      slug={slug}
                      label="Open"
                      entries={waiting}
                      {...section(OPEN)}
                    />
                  </InboxDropZone>
                )}

                {inbox.data && (
                  <div className="mt-auto pt-4">
                    <InboxSection
                      slug={slug}
                      label="Running"
                      entries={working}
                      {...section(RUNNING)}
                    />

                    <InboxDropZone id={RESOLVED_DROP}>
                      <InboxSection
                        slug={slug}
                        label="Resolved"
                        entries={done}
                        count={
                          resolvedInbox.data &&
                          `${done.length}${resolvedInbox.more.available ? '+' : ''}`
                        }
                        {...section(RESOLVED)}
                        after={
                          <ShowMore
                            list={resolvedInbox}
                            what="Resolved items"
                            skeleton={<InboxRowSkeleton />}
                          />
                        }
                      />
                    </InboxDropZone>
                  </div>
                )}
              </ScrollArea>

              <InboxDragOverlay slug={slug} entry={drag.dragged} />
            </DndContext>

            <PaneHandle {...listHandle} edge="right" resizing={listResizing} />
          </div>

          <PageOutlet what="The message" centered />
        </div>
      </FileDropZone>
    </TrailContext>
  );
}
