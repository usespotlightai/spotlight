import { Check, X } from 'lucide-react';
import { CodeBlock } from '@/components/shared/CodeBlock';
import { took } from '@/lib/inbox';
import { type StackCheck, stepName, stepsOf } from '@/lib/replay-outcome';
import { cn } from '@/lib/utils';

export function ReplayCheck({ check }: { check: StackCheck }) {
  const steps = stepsOf(check);

  return (
    <div data-slot="replay-check" className="flex flex-col gap-2">
      <p className="font-mono text-foreground text-xs">{check.command}</p>

      {check.state === 'waiting' && (
        <p className="text-muted-foreground text-xs">Still checking.</p>
      )}

      {check.state === 'skipped' && (
        <p className="text-muted-foreground text-xs">
          Skipped{check.reason ? `: ${check.reason}` : '.'}
        </p>
      )}

      {steps.length > 0 && (
        <ul className="flex flex-col gap-2">
          {steps.map((step) => (
            <li key={step.step} className="flex flex-col gap-1">
              <p className="flex items-center gap-1.5 text-xs">
                {step.passed ? (
                  <Check
                    aria-hidden
                    className="size-3.5 text-emerald-600 dark:text-emerald-400"
                  />
                ) : (
                  <X aria-hidden className="size-3.5 text-destructive" />
                )}
                <span
                  className={cn(
                    'font-medium',
                    step.passed ? 'text-foreground' : 'text-destructive',
                  )}
                >
                  {stepName(step)}
                </span>
                <span className="text-muted-foreground">
                  · {step.passed ? 'passed' : 'failed'} in {took(step.tookMs)}
                </span>
              </p>

              {!step.passed && step.output && (
                <CodeBlock output={step.output} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
