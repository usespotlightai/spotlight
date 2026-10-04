import { ApprovalRow } from '@/components/features/inbox/conversation/approval/ApprovalRow';
import { ApprovalTable } from '@/components/features/inbox/conversation/approval/ApprovalTable';
import { CodeBlock } from '@/components/shared/CodeBlock';
import {
  type Approval,
  changedNames,
  labelOf,
  readsAsCode,
  shownInputs,
} from '@/lib/approval';
import { cn } from '@/lib/utils';

export function ApprovalAction({ approval }: { approval: Approval }) {
  const changed = changedNames(approval);

  return (
    <ApprovalTable as="dl">
      {shownInputs(approval).map((input) => {
        const label = labelOf(approval, input);

        return (
          <ApprovalRow key={input.name}>
            {label && (
              <dt className="flex flex-col text-muted-foreground text-sm leading-6">
                <span className="truncate first-letter:uppercase">{label}</span>
                {changed.has(input.name) && (
                  <span className="text-[11px] leading-4">changed by you</span>
                )}
              </dt>
            )}
            <dd className={cn(!label && 'col-span-2')}>
              {readsAsCode(approval, input) ? (
                <CodeBlock
                  command={input.value}
                  className="rounded-none border-0 bg-transparent p-0 py-1"
                />
              ) : (
                <p className="whitespace-pre-wrap break-words text-foreground text-sm leading-6">
                  {input.value}
                </p>
              )}
            </dd>
          </ApprovalRow>
        );
      })}
    </ApprovalTable>
  );
}
