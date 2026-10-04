import { useId } from 'react';
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
    <div className="[&>*+*]:border-t-[0.5px] [&>*+*]:border-border">
      {approval.inputs.map((input, at) => (
        <div
          key={input.name}
          className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-4 py-2 first:pt-0 last:pb-0"
        >
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
        </div>
      ))}
    </div>
  );
}
