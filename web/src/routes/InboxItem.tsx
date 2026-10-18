import { useParams } from 'react-router';
import { InboxItemConversation } from '@/components/features/inbox/conversation/InboxItemConversation';
import { InboxGone } from '@/components/features/inbox/InboxGone';
import { InboxItemSkeleton } from '@/components/features/inbox/InboxItemSkeleton';
import { InboxRequestPage } from '@/components/features/inbox/InboxRequestPage';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { useInbox } from '@/hooks/api/useInbox';
import { useInboxItemRefresh } from '@/hooks/api/useInboxItemRefresh';
import { useMarkReadOnView } from '@/hooks/api/useMarkReadOnView';
import { useTaskJournal } from '@/hooks/api/useTaskJournal';
import { useClearedParam } from '@/hooks/useClearedParam';
import { useInboxItemTrail } from '@/hooks/useInboxItemTrail';
import { taskItemOf } from '@/lib/inbox';
import { failed, loading } from '@/lib/query';
import { useTrail } from '@/lib/trail';

export function InboxItem() {
  const { slug, itemId } = useParams();
  useClearedParam('connected');
  const inbox = useInbox(slug);
  const item = taskItemOf(inbox.data, itemId);
  const journal = useTaskJournal(
    slug,
    item?.inboxRequest ? undefined : item?.taskId,
  );

  useInboxItemRefresh(slug, item);
  useMarkReadOnView(slug, item);

  const { trail } = useTrail(useInboxItemTrail(slug, item));

  if (loading(inbox) || (item && !item.inboxRequest && loading(journal))) {
    return <InboxItemSkeleton />;
  }

  if (failed(inbox)) {
    return (
      <PageNotice>
        <CouldNotLoad
          what="The inbox"
          retrying={inbox.isFetching}
          onRetry={() => void inbox.refetch()}
        />
      </PageNotice>
    );
  }

  if (!item || !slug) {
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
    <InboxItemConversation
      slug={slug}
      item={item}
      worked={journal.data ?? []}
      trail={trail}
    />
  );
}
