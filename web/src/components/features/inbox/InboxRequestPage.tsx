import { StationAlertCard } from '@/components/features/inbox/alerts/StationAlertCard';
import { GradeThread } from '@/components/features/inbox/grades/GradeThread';
import { InboxDetailLayout } from '@/components/features/inbox/InboxDetailLayout';
import { MemoryThread } from '@/components/features/inbox/memories/MemoryThread';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import type { InboxItem } from '@/lib/inbox';

type InboxRequestPageProps = {
  slug: string;
  item: InboxItem;
  inboxRequest: NonNullable<InboxItem['inboxRequest']>;
  trail: readonly BreadcrumbSegment[];
};

export function InboxRequestPage({
  slug,
  item,
  inboxRequest,
  trail,
}: InboxRequestPageProps) {
  if (inboxRequest.form === 'memories') {
    return (
      <MemoryThread
        slug={slug}
        teamId={item.teamId}
        taskId={item.taskId}
        runId={inboxRequest.about}
        trail={trail}
      />
    );
  }

  if (inboxRequest.form === 'alert') {
    return (
      <InboxDetailLayout trail={trail}>
        <StationAlertCard
          slug={slug}
          teamId={item.teamId}
          alertId={inboxRequest.about}
        />
      </InboxDetailLayout>
    );
  }

  return (
    <GradeThread
      slug={slug}
      teamId={item.teamId}
      taskId={item.taskId}
      runId={inboxRequest.about}
      trail={trail}
    />
  );
}
