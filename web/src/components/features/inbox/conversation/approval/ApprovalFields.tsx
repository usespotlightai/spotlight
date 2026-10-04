import { useId } from 'react';
import { ApprovalRow } from '@/components/features/inbox/conversation/approval/ApprovalRow';
import { ApprovalTable } from '@/components/features/inbox/conversation/approval/ApprovalTable';
import { AutoGrowTextarea } from '@/components/shared/form/AutoGrowTextarea';
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
    <ApprovalTable as="div">
      {approval.inputs.map((input, at) => (
        <ApprovalRow key={input.name}>
          <label
            htmlFor={`${id}-${input.name}`}
            className="truncate text-muted-foreground text-sm leading-6 first-letter:uppercase"
          >
            {input.name}
          </label>
          <AutoGrowTextarea
            id={`${id}-${input.name}`}
            value={edits[input.name] ?? input.value}
            disabled={disabled}
            autoFocus={at === 0}
            onChange={(event) => onEdit(input.name, event.target.value)}
            className={cn(
              '-mx-1.5 -my-0.5 rounded-md px-1.5 py-0.5 text-foreground text-sm leading-6 transition-colors hover:bg-accent focus-visible:bg-accent',
              readsAsCode(approval, input) &&
                'font-mono text-[11px] leading-[1.6]',
            )}
          />
        </ApprovalRow>
      ))}
    </ApprovalTable>
  );
}
