import { JudgeDisagreementItem } from '@/components/features/inbox/disagreements/JudgeDisagreementItem';
import { InboxDetailLayout } from '@/components/features/inbox/InboxDetailLayout';
import { InboxItemSkeleton } from '@/components/features/inbox/InboxItemSkeleton';
import { RunThread } from '@/components/features/inbox/RunThread';
import { MembersOnly } from '@/components/features/team/MembersOnly';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { useJudgeDisagreement } from '@/hooks/api/useJudgeDisagreement';
import { notFound } from '@/lib/error';
import { failed, loading } from '@/lib/query';

type JudgeDisagreementThreadProps = {
  slug: string;
  teamId: string;
  disagreementId: string;
  trail: readonly BreadcrumbSegment[];
};

export function JudgeDisagreementThread({
  slug,
  teamId,
  disagreementId,
  trail,
}: JudgeDisagreementThreadProps) {
  const disagreement = useJudgeDisagreement(teamId, disagreementId);

  if (loading(disagreement)) {
    return <InboxItemSkeleton />;
  }

  if (failed(disagreement) && notFound(disagreement.error)) {
    return (
      <InboxDetailLayout trail={trail}>
        <MembersOnly title="You cannot see this question" />
      </InboxDetailLayout>
    );
  }

  if (failed(disagreement) || !disagreement.data) {
    return (
      <InboxDetailLayout trail={trail}>
        <CouldNotLoad
          what="The question"
          retrying={disagreement.isFetching}
          onRetry={() => void disagreement.refetch()}
          className="items-start"
        />
      </InboxDetailLayout>
    );
  }

  return (
    <RunThread
      slug={slug}
      teamId={teamId}
      taskId={disagreement.data.taskId}
      runId={disagreement.data.runId}
      trail={trail}
      after={
        <JudgeDisagreementItem
          slug={slug}
          teamId={teamId}
          disagreement={disagreement.data}
        />
      }
    />
  );
}
