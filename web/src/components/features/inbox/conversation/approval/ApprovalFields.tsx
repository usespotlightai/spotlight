import { useId } from 'react';
import { FACT_LABEL, FactRow } from '@/components/shared/FactRow';
import { InPlaceTextarea } from '@/components/shared/form/InPlaceTextarea';
import { type Approval, readsAsCode } from '@/lib/approval';
import { cn } from '@/lib/utils';

type ApprovalFieldsProps = {
  approval: Approval;
  edits: Readonly<Record<string, string>>;
  disabled: boolean;
  onEdit: (name: string, value: string) => void;
};

export function ApprovalFields({
  approval,
  edits,
  disabled,
  onEdit,
}: ApprovalFieldsProps) {
  const id = useId();

  return (
    <div>
      {approval.inputs.map((input, at) => (
        <FactRow key={input.name}>
          <label
            htmlFor={`${id}-${input.name}`}
            className={cn(FACT_LABEL, 'truncate first-letter:uppercase')}
          >
            {input.name}
          </label>
          <InPlaceTextarea
            id={`${id}-${input.name}`}
            value={edits[input.name] ?? input.value}
            disabled={disabled}
            autoFocus={at === 0}
            onChange={(event) => onEdit(input.name, event.target.value)}
            className={cn(
              readsAsCode(approval, input) &&
                'font-mono text-[11px] leading-[1.6]',
            )}
          />
        </FactRow>
      ))}
    </div>
  );
}
