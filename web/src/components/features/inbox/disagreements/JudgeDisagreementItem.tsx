import { DisputedClaimCard } from '@/components/features/inbox/disagreements/DisputedClaimCard';
import { JudgeDisagreementCard } from '@/components/features/inbox/disagreements/JudgeDisagreementCard';
import { useMembers } from '@/hooks/api/useMembers';
import { useRunScores } from '@/hooks/api/useRunScores';
import { useMe } from '@/hooks/useMe';
import {
  answererOf,
  askedNameOf,
  askedOtherThan,
  DISPUTED_CLAIMS_LABEL,
  disputedClaimsOf,
  type JudgeDisagreement,
  labelGradeOf,
  labellerOf,
  sentenceOf,
  waitsForViewer,
} from '@/lib/judge-disagreement';
import { loading } from '@/lib/query';

type JudgeDisagreementItemProps = {
  slug: string;
  teamId: string;
  disagreement: JudgeDisagreement;
};

export function JudgeDisagreementItem({
  slug,
  teamId,
  disagreement,
}: JudgeDisagreementItemProps) {
  const scores = useRunScores(teamId, disagreement.runId);
  const me = useMe();
  const members = useMembers(teamId).data;

  const disputed = disputedClaimsOf(disagreement);
  const waiting = waitsForViewer(disagreement, me);
  const asked = askedNameOf(disagreement, members);

  return (
    <div data-slot="judge-disagreement-item" className="flex flex-col gap-2">
      <p
        data-slot="disagreement-fact"
        className="break-words text-foreground text-sm leading-6"
      >
        {sentenceOf(
          disagreement,
          labellerOf(disagreement, me, members),
          waiting,
        )}
      </p>

      {disputed.length > 0 ? (
        <ul aria-label={DISPUTED_CLAIMS_LABEL} className="flex flex-col gap-3">
          {disputed.map((claim) => (
            <li key={claim.index}>
              <DisputedClaimCard
                slug={slug}
                teamId={teamId}
                disagreement={disagreement}
                claim={claim}
                scores={scores.data}
                grade={labelGradeOf(disagreement, scores.data, members)}
                loading={loading(scores)}
                canAnswer={!askedOtherThan(disagreement, me)}
                answererOf={(answeredBy) => answererOf(answeredBy, me, members)}
                asked={asked}
              />
            </li>
          ))}
        </ul>
      ) : (
        <JudgeDisagreementCard
          slug={slug}
          teamId={teamId}
          disagreement={disagreement}
          answerer={answererOf(
            disagreement.notMet?.answeredBy ?? null,
            me,
            members,
          )}
          asked={asked}
          waitsForViewer={waiting}
        />
      )}
    </div>
  );
}
