import { useId } from 'react';
import { ChoiceSelect } from '@/components/shared/form/ChoiceSelect';
import { FieldInput } from '@/components/shared/form/FieldInput';
import {
  JOB_FUNCTIONS,
  type JobFunction,
  jobFunctionOf,
} from '@/lib/signup-survey';

type SignupSurveyFieldsProps = {
  jobFunction: JobFunction | null;
  referralSource: string;
  onJobFunctionChange: (jobFunction: JobFunction | null) => void;
  onReferralSourceChange: (referralSource: string) => void;
};

export function SignupSurveyFields({
  jobFunction,
  referralSource,
  onJobFunctionChange,
  onReferralSourceChange,
}: SignupSurveyFieldsProps) {
  const referralId = useId();

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-2">
        <p className="font-medium text-foreground">What is your role?</p>
        <ChoiceSelect
          label="Role"
          choices={JOB_FUNCTIONS}
          value={jobFunction}
          placeholder="Select your role"
          clearable={false}
          onChange={(value) => onJobFunctionChange(jobFunctionOf(value))}
          input
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={referralId} className="text-foreground">
          <span className="font-medium">Where did you hear about us?</span>{' '}
          <span className="text-muted-foreground">(optional)</span>
        </label>
        <FieldInput
          id={referralId}
          name="referralSource"
          type="text"
          autoComplete="off"
          maxLength={200}
          placeholder="For example, a colleague or a web search"
          value={referralSource}
          onChange={(event) => onReferralSourceChange(event.target.value)}
          className="h-9 bg-card"
        />
      </div>
    </div>
  );
}
