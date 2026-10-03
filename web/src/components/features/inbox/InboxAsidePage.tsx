import { AsideLayout } from '@/components/features/inbox/AsideLayout';
import { StationAlertCard } from '@/components/features/inbox/alerts/StationAlertCard';
import { GradeRun } from '@/components/features/inbox/grades/GradeRun';
import { MemoryReview } from '@/components/features/inbox/memories/MemoryReview';
import { RunSidePanel } from '@/components/features/runs/RunSidePanel';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
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
      <AsideLayout trail={trail}>
        <MemoryReview
          slug={slug}
          teamId={item.teamId}
          taskId={item.taskId}
          runId={aside.about}
        />
      </AsideLayout>
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
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={<Breadcrumbs segments={trail} />} />

      <RunSidePanel>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col px-8 py-8">
            <GradeRun
              slug={slug}
              teamId={item.teamId}
              taskId={item.taskId}
              runId={aside.about}
              title={item.title}
              description={item.description}
            />
          </div>
        </div>
      </RunSidePanel>
    </div>
  );
}
