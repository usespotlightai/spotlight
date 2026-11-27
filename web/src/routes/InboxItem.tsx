import { useParams } from 'react-router';

import { InboxItemConversation } from '@/components/features/inbox/conversation/InboxItemConversation';
import { InboxGone } from '@/components/features/inbox/InboxGone';
import { InboxItemSkeleton } from '@/components/features/inbox/InboxItemSkeleton';
import { InboxRequestPage } from '@/components/features/inbox/InboxRequestPage';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { useInboxItem } from '@/hooks/api/useInbox';
import { useInboxItemRefresh } from '@/hooks/api/useInboxItemRefresh';
import { useMarkReadOnView } from '@/hooks/api/useMarkReadOnView';
import { useTaskFooterLoading } from '@/hooks/api/useTaskFooterLoading';
import { useTaskJournal } from '@/hooks/api/useTaskJournal';
import { useClearedParam } from '@/hooks/useClearedParam';
import { useInboxItemTrail } from '@/hooks/useInboxItemTrail';
import { notFound } from '@/lib/error';
import {
  type InboxItem as InboxItemData,
  inboxPath,
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
  Boolean(item && !item.inboxRequest && (loading(journal) || footerLoading));

export function InboxItem() {
  const { slug, itemId } = useParams();
  useClearedParam('connected');
  const found = useInboxItem(slug, itemId);
  const item = found.data;
  const journal = useTaskJournal(
    slug,
    item?.inboxRequest ? undefined : item?.taskId,
    item ? runsShownFirst(item) : [],
  );

  useInboxItemRefresh(slug, item);
  useMarkReadOnView(slug, item);

  const { trail } = useTrail(useInboxItemTrail(slug, item));

  const footerLoading = useTaskFooterLoading(
    item?.teamId,
    item?.inboxRequest ? undefined : item?.taskId,
  );

  if (itemLoading(found, item, journal, footerLoading)) {
    return <InboxItemSkeleton />;
  }

  if (failed(found) && !notFound(found.error)) {
    return (
      <PageNotice
        title={
          <Breadcrumbs
            segments={[{ label: 'Inbox', to: inboxPath(slug ?? '') }]}
          />
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

  if (!item || !nonEmpty(slug)) {
    return <InboxGone />;
  }

  if (item.inboxRequest) {
    return (
      <InboxRequestPage
        slug={slug}
        item={item}
        inboxRequest={item.inboxRequest}
        trail={trail}
      />
    );
  }

  return (
    <JournalDemandContext value={journal.demand}>
      <InboxItemConversation
        slug={slug}
        item={item}
        worked={journal.data ?? []}
        trail={trail}
      />
    </JournalDemandContext>
  );
}
