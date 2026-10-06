import { Modified } from '@/components/features/inbox/conversation/approval/Modified';
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
        const modified = changed.has(input.name);

        return (
          <FactRow key={input.name}>
            {label && (
              <dt className={cn(FACT_LABEL, 'truncate first-letter:uppercase')}>
                {label}
              </dt>
            )}
            <dd className={cn(!label && 'col-span-2')}>
              {readsAsCode(approval, input) ? (
                <>
                  <CodeBlock command={input.value} className="px-2.5 py-1.5" />
                  {modified && <Modified />}
                </>
              ) : (
                <p className={FACT_VALUE}>
                  {input.value}
                  {modified && (
                    <>
                      {' '}
                      <Modified />
                    </>
                  )}
                </p>
              )}
            </dd>
          </FactRow>
        );
      })}
    </dl>
  );
}
