import { useParams } from 'react-router';
import { InboxEmpty } from '@/components/features/inbox/InboxEmpty';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { useInbox } from '@/hooks/api/useInbox';
import { failed } from '@/lib/query';

export function InboxIndex() {
  const { slug } = useParams();
  const inbox = useInbox(slug);

  if (!slug) {
    return null;
  }

  return (
    <PageNotice>
      {failed(inbox) ? (
        <CouldNotLoad
          what="The inbox"
          retrying={inbox.isFetching}
          onRetry={() => void inbox.refetch()}
        />
      ) : inbox.data?.length === 0 ? (
        <InboxEmpty slug={slug} />
      ) : (
        <p className="text-muted-foreground text-sm">
          Pick a task to see what it is waiting on.
        </p>
      )}
    </PageNotice>
  );
}
