import type { Citation } from '@/lib/judge';

type Step = NonNullable<Citation['step']>;

export function CitedStep({ step }: { step: Step }) {
  return (
    <div
      data-slot="cited-step"
      className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/60 px-3 py-2"
    >
      <span className="text-muted-foreground text-xs">
        Step {step.index}
        {step.kind && ` · ${step.tool ?? step.kind}`}
      </span>
      <p className="whitespace-pre-wrap break-words text-foreground text-xs leading-5">
        {step.text ?? 'Step is no longer in the run’s journal.'}
      </p>
    </div>
  );
}
