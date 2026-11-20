import { useParams } from 'react-router';

import { InboxDetailLayout } from '@/components/features/inbox/InboxDetailLayout';
import { InboxGone } from '@/components/features/inbox/InboxGone';
import { NoticeCard } from '@/components/features/inbox/notices/NoticeCard';
import { NoticeSkeleton } from '@/components/features/inbox/notices/NoticeSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { useInboxNotice } from '@/hooks/api/useInbox';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useResolveNoticeOnOpening } from '@/hooks/useResolveNoticeOnOpening';
import { notFound } from '@/lib/error';
import { inboxPath } from '@/lib/inbox';
import { failed, loading } from '@/lib/query';
import { teamPath } from '@/lib/team';
import { TrailContext, useTrail } from '@/lib/trail';

export function InboxNotice() {
  const { slug, noticeId } = useParams();
  const found = useInboxNotice(slug, noticeId);
  const notice = found.data;
  const { data: workspace } = useWorkspace(slug);
  const pending = notice && !notice.resolved ? notice.id : null;
  const resolve = useResolveNoticeOnOpening(slug, pending);

  const team = workspace?.teams.find(
    (candidate) => candidate.id === notice?.teamId,
  );

  const base: BreadcrumbSegment[] = [
    ...(team && slug
      ? [{ label: team.name, avatar: team.name, to: teamPath(slug, team.id) }]
      : []),
    ...(notice ? [{ label: notice.headline }] : []),
  ];
  const { trail, forward } = useTrail(base);

  if (loading(found)) {
    return <NoticeSkeleton />;
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
          what="The notice"
          retrying={found.isFetching}
          onRetry={() => void found.refetch()}
        />
      </PageNotice>
    );
  }

  if (!notice || !slug || notFound(resolve.error)) {
    return <InboxGone />;
  }

  return (
    <TrailContext value={forward}>
      <InboxDetailLayout trail={trail}>
        <NoticeCard slug={slug} notice={notice} />
      </InboxDetailLayout>
    </TrailContext>
  );
}
