import { useState } from 'react';

import { DisagreementNote } from '@/components/features/inbox/disagreements/DisagreementNote';
import { NotMetClaimPick } from '@/components/features/inbox/disagreements/NotMetClaimPick';
import { DecisionButton } from '@/components/shared/DecisionButton';
import { DecisionControls } from '@/components/shared/DecisionControls';
import { DisabledReasonTooltip } from '@/components/shared/DisabledReasonTooltip';
import {
  EMPTY_NOT_MET_DRAFT,
  type JudgeDisagreement,
  type NotMetAnswer,
  type NotMetDraft,
  notMetAnswerOf,
  notMetBlockedReason,
  noteRequired,
  SEND_ANSWER,
  WHAT_WAS_WRONG,
} from '@/lib/judge-disagreement';

type DisagreementFormProps = {
  disagreement: JudgeDisagreement;
  pending: boolean;
  onAnswer: (answer: NotMetAnswer) => void;
};

export function DisagreementForm({
  disagreement,
  pending,
  onAnswer,
}: DisagreementFormProps) {
  const [draft, setDraft] = useState<NotMetDraft>(EMPTY_NOT_MET_DRAFT);
  const answer = notMetAnswerOf(draft);
  const blocked = pending ? null : notMetBlockedReason(draft);

  return (
    <form
      data-slot="disagreement-form"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (answer) {
          onAnswer(answer);
        }
      }}
    >
      <dl>
        <NotMetClaimPick
          claims={disagreement.claims}
          picked={draft.notMet}
          pending={pending}
          onPick={(notMet) => setDraft((was) => ({ ...was, notMet }))}
        />
        <DisagreementNote
          label={WHAT_WAS_WRONG}
          required={noteRequired(draft)}
          pending={pending}
          value={draft.note}
          onChange={(note) => setDraft((was) => ({ ...was, note }))}
        />
      </dl>

      <DecisionControls>
        <DisabledReasonTooltip reason={blocked}>
          {(describedBy) => (
            <DecisionButton
              type="submit"
              variant="default"
              disabled={pending || !answer}
              aria-describedby={describedBy}
            >
              {SEND_ANSWER}
            </DecisionButton>
          )}
        </DisabledReasonTooltip>
      </DecisionControls>
    </form>
  );
}
