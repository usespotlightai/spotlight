import { CodeBlock } from '@/components/shared/CodeBlock';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ShownStep } from '@/lib/journal-step';

type StepBodyProps = {
  shown: ShownStep;
  command: string;
};

export function StepBody({ shown, command }: StepBodyProps) {
  if (shown.prose) {
    return (
      <ScrollArea orientation="both" className="mt-0.5 mb-1 max-h-64">
        <p className="ms-1 whitespace-pre-wrap text-muted-foreground text-xs leading-5">
          {shown.body}
        </p>
      </ScrollArea>
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
