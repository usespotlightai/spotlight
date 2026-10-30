import { useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { InboxDetailLayout } from '@/components/features/inbox/InboxDetailLayout';
import { InboxGone } from '@/components/features/inbox/InboxGone';
import { NoticeCard } from '@/components/features/inbox/notices/NoticeCard';
import { NoticeSkeleton } from '@/components/features/inbox/notices/NoticeSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { useInbox } from '@/hooks/api/useInbox';
import { useResolveInboxNotice } from '@/hooks/api/useResolveInboxNotice';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { notFound } from '@/lib/error';
import { noticeOf } from '@/lib/inbox';
import { failed, loading } from '@/lib/query';
import { teamPath } from '@/lib/team';
import { TrailContext, useTrail } from '@/lib/trail';

const RESOLVE_AFTER_MS = 3000;

export function InboxNotice() {
  const { slug, noticeId } = useParams();
  const inbox = useInbox(slug);
  const notice = noticeOf(inbox.data, noticeId);
  const { data: workspace } = useWorkspace(slug);
  const resolve = useResolveInboxNotice();
  const pending = notice && !notice.resolved ? notice.id : null;
  const resolvedOnOpening = useRef<string | null>(null);

  useEffect(() => {
    if (!slug || !pending || resolvedOnOpening.current === pending) {
      return;
    }

    const timer = setTimeout(() => {
      resolvedOnOpening.current = pending;
      resolve.mutate({ slug, noticeId: pending });
    }, RESOLVE_AFTER_MS);

    return () => clearTimeout(timer);
  }, [slug, pending, resolve.mutate]);

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

  if (loading(inbox)) {
    return <NoticeSkeleton />;
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
