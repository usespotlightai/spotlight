import { useParams } from 'react-router';
import { InboxItemConversation } from '@/components/features/inbox/conversation/InboxItemConversation';
import { InboxAsidePage } from '@/components/features/inbox/InboxAsidePage';
import { InboxItemSkeleton } from '@/components/features/inbox/InboxItemSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { useInbox } from '@/hooks/api/useInbox';
import { useInboxItemRefresh } from '@/hooks/api/useInboxItemRefresh';
import { useReadOnSight } from '@/hooks/api/useReadOnSight';
import { useTaskJournal } from '@/hooks/api/useTaskJournal';
import { useInboxItemTrail } from '@/hooks/useInboxItemTrail';
import { failed, loading } from '@/lib/query';
import { useTrail } from '@/lib/trail';

export function InboxItem() {
  const { slug, itemId } = useParams();
  const inbox = useInbox(slug);
  const item = inbox.data?.find((each) => each.id === itemId);
  const journal = useTaskJournal(slug, item?.aside ? undefined : item?.taskId);

  useInboxItemRefresh(slug, item);
  useReadOnSight(slug, item);

  const { trail } = useTrail(useInboxItemTrail(slug, item));

  if (loading(inbox) || (item && !item.aside && loading(journal))) {
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
    return (
      <PageNotice>
        <p className="text-muted-foreground text-sm">
          Nothing here is waiting on you any more.
        </p>
      </PageNotice>
    );
  }

  if (item.aside) {
    return (
      <InboxAsidePage
        slug={slug}
        item={item}
        aside={item.aside}
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
