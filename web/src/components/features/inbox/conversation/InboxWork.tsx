import { ContextDonut } from '@/components/features/inbox/conversation/ContextDonut';
import { StepsDisclosure } from '@/components/features/inbox/conversation/StepsDisclosure';
import { RunChanges } from '@/components/features/runs/RunChanges';
import { counted, type RunJournal, took } from '@/lib/inbox';

export function InboxWork({ journals }: { journals: readonly RunJournal[] }) {
  const steps = journals.flatMap((each) => each.steps);

  if (steps.length === 0) {
    return null;
  }

  const attempts = journals.length;
  const ms = journals.reduce((all, each) => all + (each.ms ?? 0), 0);
  const spent = journals.map((each) => each.spent).filter(Boolean)[0];

  return (
    <StepsDisclosure
      steps={steps}
      label={
        <>
          <span>
            {ms > 0 ? `Worked for ${took(ms)}` : 'Worked'} · {steps.length}{' '}
            {steps.length === 1 ? 'step' : 'steps'}
            {attempts > 1 && ` over ${attempts} attempts`}
            {spent && ' ·'}
          </span>
          {spent && (
            <span
              className="flex items-center gap-1"
              title={`Tokens in context: ${counted(spent.used)} of ${counted(spent.size)}`}
            >
              <ContextDonut used={spent.used} size={spent.size} />
              {counted(spent.used)}/{counted(spent.size)}
            </span>
          )}
        </>
      }
    >
      <RunChanges journals={journals} />
    </StepsDisclosure>
  );
}
