import { use, useId, useRef, useState } from 'react';

import { ClaimAnsweredRows } from '@/components/features/inbox/disagreements/ClaimAnsweredRows';
import { ClaimAnswerRow } from '@/components/features/inbox/disagreements/ClaimAnswerRow';
import { DisagreementCardHeader } from '@/components/features/inbox/disagreements/DisagreementCardHeader';
import { DisagreementNote } from '@/components/features/inbox/disagreements/DisagreementNote';
import { DisputedClaimRows } from '@/components/features/inbox/disagreements/DisputedClaimRows';
import { DecisionButton } from '@/components/shared/DecisionButton';
import { DecisionCard } from '@/components/shared/DecisionCard';
import { DecisionControls } from '@/components/shared/DecisionControls';
import { DisabledReasonTooltip } from '@/components/shared/DisabledReasonTooltip';
import { useAnswerDisagreementClaim } from '@/hooks/api/useAnswerDisagreementClaim';
import type { RunScores } from '@/lib/judge';
import {
  answerOfClaim,
  cardStateOf,
  claimAnswerOf,
  claimBlockedReason,
  claimCardLabel,
  claimCardTitleOf,
  type ClaimDraft,
  type DisagreementClaim,
  EMPTY_CLAIM_DRAFT,
  type JudgeDisagreement,
  reasonsOf,
  SEND_ANSWER,
  WHY,
} from '@/lib/judge-disagreement';
import { NOT_ANSWERED, SettledPartContext } from '@/lib/settled-part';
import { taskTracePath } from '@/lib/task';

type DisputedClaimCardProps = {
  slug: string;
  teamId: string;
  disagreement: JudgeDisagreement;
  claim: DisagreementClaim;
  scores: RunScores | undefined;
  loading: boolean;
  answererOf: (answeredBy: string) => string | null;
};

export function DisputedClaimCard({
  slug,
  teamId,
  disagreement,
  claim,
  scores,
  loading,
  answererOf,
}: DisputedClaimCardProps) {
  const send = useAnswerDisagreementClaim();
  const [draft, setDraft] = useState<ClaimDraft>(EMPTY_CLAIM_DRAFT);
  const section = useRef<HTMLElement>(null);
  const textId = useId();
  const formId = useId();

  const state = cardStateOf(disagreement, claim.index);
  const settled = use(SettledPartContext);
  const given = answerOfClaim(disagreement, claim.index);
  const answering = state === 'open';
  const body = claimAnswerOf(draft);
  const blocked = send.isPending ? null : claimBlockedReason(draft);

  const rows = (
    <DisputedClaimRows
      claim={claim}
      reasons={reasonsOf(claim, scores)}
      loading={loading}
      textId={textId}
    >
      {answering ? (
        <>
          <ClaimAnswerRow
            textId={textId}
            answer={draft.answer ?? undefined}
            pending={send.isPending}
            onAnswer={(answer) => setDraft((was) => ({ ...was, answer }))}
          />
          <DisagreementNote
            label={WHY}
            required={false}
            pending={send.isPending}
            value={draft.note}
            onChange={(note) => setDraft((was) => ({ ...was, note }))}
          />
        </>
      ) : (
        given && <ClaimAnsweredRows answer={given} />
      )}
    </DisputedClaimRows>
  );

  return (
    <DecisionCard
      ref={section}
      tabIndex={-1}
      data-slot="judge-disagreement"
      data-state={state}
      aria-label={claimCardLabel(claim.index)}
      className="outline-none"
    >
      <DisagreementCardHeader
        state={state}
        title={
          settled && state === 'open'
            ? NOT_ANSWERED
            : claimCardTitleOf(
                disagreement,
                claim.index,
                given ? answererOf(given.answeredBy) : null,
              )
        }
        sending={send.isPending}
        at={
          state === 'withdrawn'
            ? disagreement.withdrawnAt
            : (given?.answeredAt ?? null)
        }
        trace={taskTracePath(slug, teamId, disagreement.taskId)}
      />

      {answering ? (
        <form
          id={formId}
          data-slot="disagreement-form"
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (body) {
              send.mutate(
                {
                  slug,
                  teamId,
                  disagreementId: disagreement.id,
                  claim: claim.index,
                  answer: body,
                },
                {
                  onSuccess: () =>
                    section.current?.focus({ preventScroll: true }),
                },
              );
            }
          }}
        >
          {rows}
          <DecisionControls>
            <DisabledReasonTooltip reason={blocked}>
              {(describedBy) => (
                <DecisionButton
                  type="submit"
                  form={formId}
                  variant="default"
                  disabled={send.isPending || !body}
                  aria-describedby={describedBy}
                >
                  {SEND_ANSWER}
                </DecisionButton>
              )}
            </DisabledReasonTooltip>
          </DecisionControls>
        </form>
      ) : (
        rows
      )}
    </DecisionCard>
  );
}
