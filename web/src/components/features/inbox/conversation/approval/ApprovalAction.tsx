import { CodeBlock } from '@/components/shared/CodeBlock';
import { FACT_LABEL, FACT_VALUE, FactRow } from '@/components/shared/FactRow';
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
    <dl>
      {shownInputs(approval).map((input) => {
        const label = labelOf(approval, input);

        return (
          <FactRow key={input.name}>
            {label && (
              <dt className={cn(FACT_LABEL, 'flex flex-col')}>
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
                <p className={FACT_VALUE}>{input.value}</p>
              )}
            </dd>
          </FactRow>
        );
      })}
    </dl>
  );
}
