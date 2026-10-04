import { AsideLayout } from '@/components/features/inbox/AsideLayout';
import { StationAlertCard } from '@/components/features/inbox/alerts/StationAlertCard';
import { GradeThread } from '@/components/features/inbox/grades/GradeThread';
import { MemoryThread } from '@/components/features/inbox/memories/MemoryThread';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import type { InboxItem } from '@/lib/inbox';

type InboxAsidePageProps = {
  slug: string;
  item: InboxItem;
  aside: NonNullable<InboxItem['aside']>;
  trail: readonly BreadcrumbSegment[];
};

export function InboxAsidePage({
  slug,
  item,
  aside,
  trail,
}: InboxAsidePageProps) {
  if (aside.form === 'memories') {
    return (
      <MemoryThread
        slug={slug}
        teamId={item.teamId}
        taskId={item.taskId}
        runId={aside.about}
        trail={trail}
      />
    );
  }

  if (aside.form === 'alert') {
    return (
      <AsideLayout trail={trail}>
        <StationAlertCard
          slug={slug}
          teamId={item.teamId}
          alertId={aside.about}
        />
      </AsideLayout>
    );
  }

  return (
    <GradeThread
      slug={slug}
      teamId={item.teamId}
      taskId={item.taskId}
      runId={aside.about}
      trail={trail}
    />
  );
}
