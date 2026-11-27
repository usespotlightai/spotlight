import { JudgeDisagreementItem } from '@/components/features/inbox/disagreements/JudgeDisagreementItem';
import { InboxRowSkeleton } from '@/components/features/inbox/InboxRowSkeleton';
import { MembersOnly } from '@/components/features/team/MembersOnly';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PillLink } from '@/components/shared/PillLink';
import { useJudgeDisagreement } from '@/hooks/api/useJudgeDisagreement';
import { notFound } from '@/lib/error';
import { inboxRunPath } from '@/lib/inbox';
import { failed, loading } from '@/lib/query';

type JudgeQuestionPartProps = {
  slug: string;
  teamId: string;
  disagreementId: string;
};

export function JudgeQuestionPart({
  slug,
  teamId,
  disagreementId,
}: JudgeQuestionPartProps) {
  const disagreement = useJudgeDisagreement(teamId, disagreementId);

  if (loading(disagreement)) {
    return <InboxRowSkeleton />;
  }

  if (failed(disagreement) && notFound(disagreement.error)) {
    return <MembersOnly title="You cannot see this question" />;
  }

  if (failed(disagreement) || !disagreement.data) {
    return (
      <CouldNotLoad
        what="The question"
        retrying={disagreement.isFetching}
        onRetry={() => void disagreement.refetch()}
        className="items-start"
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <JudgeDisagreementItem
        slug={slug}
        teamId={teamId}
        disagreement={disagreement.data}
      />

      <PillLink
        to={inboxRunPath(slug, teamId, disagreement.data.runId)}
        className="self-start"
      >
        Open the run
      </PillLink>
    </div>
  );
}
