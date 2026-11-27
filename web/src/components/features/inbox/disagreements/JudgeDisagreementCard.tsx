import { DisagreementAnswered } from '@/components/features/inbox/disagreements/DisagreementAnswered';
import { DisagreementCardHeader } from '@/components/features/inbox/disagreements/DisagreementCardHeader';
import { DisagreementClaimsRow } from '@/components/features/inbox/disagreements/DisagreementClaimsRow';
import { DisagreementForm } from '@/components/features/inbox/disagreements/DisagreementForm';
import { DecisionCard } from '@/components/shared/DecisionCard';
import { useAnswerJudgeDisagreement } from '@/hooks/api/useAnswerJudgeDisagreement';
import {
  disagreementTitleOf,
  type JudgeDisagreement,
} from '@/lib/judge-disagreement';
import { taskTracePath } from '@/lib/task';

type JudgeDisagreementCardProps = {
  slug: string;
  teamId: string;
  disagreement: JudgeDisagreement;
  answerer: string | null;
};

export function JudgeDisagreementCard({
  slug,
  teamId,
  disagreement,
  answerer,
}: JudgeDisagreementCardProps) {
  const send = useAnswerJudgeDisagreement();

  const { notMet, state, withdrawnAt } = disagreement;
  const answering = state === 'open';

  return (
    <DecisionCard
      data-slot="judge-disagreement"
      data-state={state}
      aria-label="Disagreement with the judge"
    >
      <DisagreementCardHeader
        state={state}
        title={disagreementTitleOf(disagreement, answerer)}
        sending={send.isPending}
        at={state === 'withdrawn' ? withdrawnAt : (notMet?.answeredAt ?? null)}
        trace={taskTracePath(slug, teamId, disagreement.taskId)}
      />

      {notMet ? (
        <DisagreementAnswered disagreement={disagreement} answer={notMet} />
      ) : answering ? (
        <DisagreementForm
          disagreement={disagreement}
          pending={send.isPending}
          onAnswer={(body) =>
            send.mutate({
              slug,
              teamId,
              disagreementId: disagreement.id,
              answer: body,
            })
          }
        />
      ) : (
        <DisagreementClaimsRow claims={disagreement.claims} />
      )}
    </DecisionCard>
  );
}
