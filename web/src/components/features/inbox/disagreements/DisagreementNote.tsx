import { type ReactElement, useId } from 'react';

import { FACT_LABEL, FactRow } from '@/components/shared/FactRow';
import { FieldTextarea } from '@/components/shared/form/FieldTextarea';
import {
  MAX_NOTE,
  NOTE_PLACEHOLDER,
  WHAT_WAS_WRONG_PLACEHOLDER,
} from '@/lib/judge-disagreement';
import { cn } from '@/lib/utils';

type DisagreementNoteProps = {
  label: string;
  required: boolean;
  pending: boolean;
  value: string;
  onChange: (note: string) => void;
};

export function DisagreementNote({
  label,
  required,
  pending,
  value,
  onChange,
}: DisagreementNoteProps): ReactElement {
  const id = useId();

  return (
    <FactRow wide>
      <dt className={cn(FACT_LABEL, '@md/pane:pt-1')}>
        <label htmlFor={id}>{label}</label>
      </dt>
      <dd>
        <FieldTextarea
          id={id}
          className="block"
          placeholder={required ? WHAT_WAS_WRONG_PLACEHOLDER : NOTE_PLACEHOLDER}
          maxLength={MAX_NOTE}
          required={required}
          disabled={pending}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </dd>
    </FactRow>
  );
}
