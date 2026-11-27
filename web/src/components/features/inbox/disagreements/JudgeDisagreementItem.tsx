import { use } from 'react';

import { DisputedClaimCard } from '@/components/features/inbox/disagreements/DisputedClaimCard';
import { JudgeDisagreementCard } from '@/components/features/inbox/disagreements/JudgeDisagreementCard';
import { Dockable } from '@/components/shared/decision-tray/Dockable';
import { useMembers } from '@/hooks/api/useMembers';
import { useRunScores } from '@/hooks/api/useRunScores';
import { useMe } from '@/hooks/useMe';
import { DecisionTrayContext, dockedRuns } from '@/lib/decision-tray';
import {
  answererOf,
  claimDecisionId,
  DISPUTED_CLAIMS_LABEL,
  disputedClaimsOf,
  type JudgeDisagreement,
  sentenceOf,
} from '@/lib/judge-disagreement';
import { loading } from '@/lib/query';

type JudgeDisagreementItemProps = {
  slug: string;
  teamId: string;
  disagreement: JudgeDisagreement;
  claim?: number;
};

export function JudgeDisagreementItem({
  slug,
  teamId,
  disagreement,
  claim,
}: JudgeDisagreementItemProps) {
  const scores = useRunScores(teamId, disagreement.runId);
  const me = useMe();
  const members = useMembers(teamId).data;

  const disputed = disputedClaimsOf(disagreement);
  const runs = dockedRuns(
    use(DecisionTrayContext),
    disputed.map((each) => claimDecisionId(each.index)),
  );
  const shown =
    claim === undefined
      ? disputed
      : disputed.filter((each) => each.index === claim);
  const allDocked =
    claim === undefined &&
    disputed.length > 0 &&
    disputed.every((each) => runs.has(claimDecisionId(each.index)));

  return (
    <div data-slot="judge-disagreement-item" className="flex flex-col gap-2">
      {!allDocked && (
        <p
          data-slot="disagreement-fact"
          className="break-words text-foreground text-sm leading-6"
        >
          {sentenceOf(disagreement)}
        </p>
      )}

      {disputed.length > 0 ? (
        <ul aria-label={DISPUTED_CLAIMS_LABEL} className="flex flex-col gap-3">
          {shown.map((each) => {
            const id = claimDecisionId(each.index);
            const run = runs.get(id);
            const card = (
              <DisputedClaimCard
                slug={slug}
                teamId={teamId}
                disagreement={disagreement}
                claim={each}
                scores={scores.data}
                loading={loading(scores)}
                answererOf={(answeredBy) => answererOf(answeredBy, me, members)}
              />
            );

            return claim === undefined ? (
              run !== 0 && (
                <li key={each.index}>
                  <Dockable id={id} run={run}>
                    {card}
                  </Dockable>
                </li>
              )
            ) : (
              <li key={each.index}>{card}</li>
            );
          })}
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
        />
      )}
    </div>
  );
}
