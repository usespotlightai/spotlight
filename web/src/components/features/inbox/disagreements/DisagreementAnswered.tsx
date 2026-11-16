import { NumberedClaim } from '@/components/features/runs/judge/NumberedClaim';
import { FACT_LABEL, FACT_VALUE, FactRow } from '@/components/shared/FactRow';
import type { NotMetAnswerResponseDto } from '@/lib/api';
import {
  CLAIM_NOT_MET,
  type JudgeDisagreement,
  NO_CLAIM_COVERS_IT,
  WHAT_WAS_WRONG,
} from '@/lib/judge-disagreement';

type DisagreementAnsweredProps = {
  disagreement: JudgeDisagreement;
  answer: NotMetAnswerResponseDto;
};

export function DisagreementAnswered({
  disagreement,
  answer,
}: DisagreementAnsweredProps) {
  const named = disagreement.claims.find((each) => each.index === answer.claim);

  return (
    <dl data-slot="disagreement-answered">
      <FactRow wide>
        <dt className={FACT_LABEL}>{CLAIM_NOT_MET}</dt>
        <dd data-slot="not-met-answer" className={FACT_VALUE}>
          {named ? (
            <NumberedClaim index={named.index}>{named.text}</NumberedClaim>
          ) : (
            NO_CLAIM_COVERS_IT
          )}
        </dd>
      </FactRow>
      {answer.note && (
        <FactRow wide>
          <dt className={FACT_LABEL}>{WHAT_WAS_WRONG}</dt>
          <dd className={FACT_VALUE}>{answer.note}</dd>
        </FactRow>
      )}
    </dl>
  );
}
