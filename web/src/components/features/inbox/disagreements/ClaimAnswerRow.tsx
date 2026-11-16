import { FACT_LABEL, FactRow } from '@/components/shared/FactRow';
import { RadioRow } from '@/components/shared/form/RadioRow';
import {
  ANSWER_LABEL,
  type ClaimAnswer,
  DISAGREEMENT_ANSWERS,
} from '@/lib/judge-disagreement';

type ClaimAnswerRowProps = {
  textId: string;
  answer: ClaimAnswer | undefined;
  pending: boolean;
  onAnswer: (answer: ClaimAnswer) => void;
};

export function ClaimAnswerRow({
  textId,
  answer,
  pending,
  onAnswer,
}: ClaimAnswerRowProps) {
  return (
    <FactRow wide>
      <dt className={FACT_LABEL}>{ANSWER_LABEL}</dt>
      <dd>
        <div
          role="radiogroup"
          aria-labelledby={textId}
          className="-mx-2 flex flex-col"
        >
          {DISAGREEMENT_ANSWERS.map((option) => (
            <RadioRow
              compact
              key={option.answer}
              name={`${textId}-answer`}
              value={option.answer}
              checked={answer === option.answer}
              disabled={pending}
              onChange={() => onAnswer(option.answer)}
            >
              {option.label}
            </RadioRow>
          ))}
        </div>
      </dd>
    </FactRow>
  );
}
