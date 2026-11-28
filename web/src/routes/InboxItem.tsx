import { useState } from 'react';
import { useParams } from 'react-router';

import { InboxItemConversation } from '@/components/features/inbox/conversation/InboxItemConversation';
import { InboxGone } from '@/components/features/inbox/InboxGone';
import { InboxItemSkeleton } from '@/components/features/inbox/InboxItemSkeleton';
import { InboxRequestPage } from '@/components/features/inbox/InboxRequestPage';
import { InboxTaskPage } from '@/components/features/inbox/parts/InboxTaskPage';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { useInboxItem } from '@/hooks/api/useInbox';
import { useInboxItemRefresh } from '@/hooks/api/useInboxItemRefresh';
import { useMarkReadOnView } from '@/hooks/api/useMarkReadOnView';
import { useTaskFooterLoading } from '@/hooks/api/useTaskFooterLoading';
import { useTaskJournal } from '@/hooks/api/useTaskJournal';
import { useCanonicalInboxItem } from '@/hooks/useCanonicalInboxItem';
import { useClearedParam } from '@/hooks/useClearedParam';
import { useInboxItemTrail } from '@/hooks/useInboxItemTrail';
import { notFound } from '@/lib/error';
import {
  firstUnreadNoteOf,
  type InboxItem as InboxItemData,
  type InboxItemView,
  inboxPath,
  requestPartsOf,
  runsShownFirst,
} from '@/lib/inbox';
import { JournalDemandContext } from '@/lib/journal-demand';
import { nonEmpty } from '@/lib/non-empty';
import { failed, type Loadable, loading } from '@/lib/query';
import { useTrail } from '@/lib/trail';

const itemLoading = (
  found: Loadable,
  item: InboxItemData | undefined,
  journal: Loadable,
  footerLoading: boolean,
): boolean =>
  loading(found) ||
  Boolean(
    item && item.conversationId !== null && (loading(journal) || footerLoading),
  );

type OpenedAt = {
  readonly id: string;
  readonly part: string | null;
  readonly note: number | null;
};

// Where the item opened, kept while it is open: reading it clears what is
// unread, and the page should not jump when that comes back.
const useOpenedAt = (
  requested: string | undefined,
  item: InboxItemData | undefined,
): OpenedAt | null => {
  const [opened, setOpened] = useState<OpenedAt | null>(null);

  if (item && nonEmpty(requested) && opened?.id !== requested) {
    const next = {
      id: requested,
      part: item.firstUnread?.partId ?? null,
      note: firstUnreadNoteOf(item),
    };

    setOpened(next);

    return next;
  }

  return opened;
};

function InboxItemNotLoaded({
  slug,
  found,
}: {
  slug: string;
  found: ReturnType<typeof useInboxItem>;
}) {
  return (
    <PageNotice
      title={
        <Breadcrumbs segments={[{ label: 'Inbox', to: inboxPath(slug) }]} />
      }
    >
      <CouldNotLoad
        what="The message"
        retrying={found.isFetching}
        onRetry={() => void found.refetch()}
      />
    </PageNotice>
  );
}

// A task's item opens on its conversation; without one, on its only request
// or on the list of its parts.
function InboxItemShown({
  slug,
  item,
  opened,
  trail,
  journal,
}: {
  slug: string;
  item: InboxItemView;
  opened: OpenedAt | null;
  trail: ReturnType<typeof useTrail>['trail'];
  journal: ReturnType<typeof useTaskJournal>;
}) {
  const requests = requestPartsOf(item);
  const only = requests.length === 1 ? requests.at(0) : undefined;

  if (item.conversationId === null && only) {
    return (
      <InboxRequestPage
        slug={slug}
        item={item}
        inboxRequest={{ ...only, about: only.about ?? '' }}
        trail={trail}
      />
    );
  }

  if (item.conversationId === null) {
    return (
      <InboxTaskPage
        slug={slug}
        item={item}
        openAt={opened?.part ?? null}
        trail={trail}
      />
    );
  }

  return (
    <JournalDemandContext value={journal.demand}>
      <InboxItemConversation
        slug={slug}
        item={item}
        conversationId={item.conversationId}
        worked={journal.data ?? []}
        openAt={opened?.note ?? null}
        openPartAt={opened?.part ?? null}
        trail={trail}
      />
    </JournalDemandContext>
  );
}

export function InboxItem() {
  const { slug, itemId } = useParams();
  useClearedParam('connected');
  const found = useInboxItem(slug, itemId);
  const item = found.data;
  const conversing = item?.conversationId !== null;
  const journal = useTaskJournal(
    slug,
    conversing ? item?.taskId : undefined,
    item ? runsShownFirst(item) : [],
  );
  const opened = useOpenedAt(itemId, item);

  useInboxItemRefresh(slug, itemId, item);
  useCanonicalInboxItem(slug, itemId, item);
  useMarkReadOnView(slug, item);

  const { trail } = useTrail(useInboxItemTrail(slug, item));

  const footerLoading = useTaskFooterLoading(
    item?.teamId,
    conversing ? item?.taskId : undefined,
  );

  if (itemLoading(found, item, journal, footerLoading)) {
    return <InboxItemSkeleton />;
  }

  if (failed(found) && !notFound(found.error)) {
    return <InboxItemNotLoaded slug={slug ?? ''} found={found} />;
  }

  if (!item || !nonEmpty(slug)) {
    return <InboxGone />;
  }

  return (
    <InboxItemShown
      slug={slug}
      item={item}
      opened={opened}
      trail={trail}
      journal={journal}
    />
  );
}
