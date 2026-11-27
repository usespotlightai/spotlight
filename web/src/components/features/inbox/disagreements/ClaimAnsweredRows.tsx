import { FACT_LABEL, FACT_VALUE, FactRow } from '@/components/shared/FactRow';
import {
  ANSWER_LABEL,
  claimAnswerLabel,
  type GivenClaimAnswer,
  WHY,
} from '@/lib/judge-disagreement';
import { nonEmpty } from '@/lib/non-empty';

export function ClaimAnsweredRows({ answer }: { answer: GivenClaimAnswer }) {
  return (
    <>
      <FactRow wide>
        <dt className={FACT_LABEL}>{ANSWER_LABEL}</dt>
        <dd data-slot="claim-answer" className={FACT_VALUE}>
          {claimAnswerLabel(answer.answer)}
        </dd>
      </FactRow>
      {nonEmpty(answer.note) && (
        <FactRow wide>
          <dt className={FACT_LABEL}>{WHY}</dt>
          <dd data-slot="claim-note" className={FACT_VALUE}>
            {answer.note}
          </dd>
        </FactRow>
      )}
    </>
  );
}
