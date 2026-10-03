import { CodeBlock } from '@/components/shared/CodeBlock';
import type { ShownStep } from '@/lib/journal-step';

type StepBodyProps = {
  shown: ShownStep;
  command: string;
};

export function StepBody({ shown, command }: StepBodyProps) {
  if (shown.prose) {
    return (
      <p className="mt-0.5 mb-1 ms-1 max-h-64 overflow-auto whitespace-pre-wrap text-muted-foreground text-xs leading-5">
        {shown.body}
      </p>
    );
  }

  return (
    <CodeBlock
      command={shown.terminal ? command : undefined}
      output={shown.body ?? ''}
      className="mt-2 mb-1 ms-1"
    />
  );
}
