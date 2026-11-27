import type { ReactNode } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { useHighlightedShell } from '@/hooks/useHighlightedShell';
import { nonEmpty } from '@/lib/non-empty';
import { cn } from '@/lib/utils';

const EDGE_FADE =
  '[mask-image:linear-gradient(to_right,transparent,black_min(24px,var(--scroll-area-overflow-x-start,0px)),black_calc(100%-min(24px,var(--scroll-area-overflow-x-end,0px))),transparent)]';

export function CodeBlock({
  command,
  output,
  className,
  trailing,
}: {
  command?: string;
  output?: string;
  className?: string;
  trailing?: ReactNode;
}) {
  const commandHtml = useHighlightedShell(command);

  return (
    <div className="flex max-h-64 overflow-hidden rounded-md border-[0.5px] border-border bg-muted/60">
      <ScrollArea
        orientation="both"
        className="min-w-0 flex-1"
        viewportClassName={EDGE_FADE}
        contentClassName={cn(
          'select-text space-y-1 px-3 py-2 font-mono text-[11px] leading-[1.6]',
          className,
        )}
      >
        {nonEmpty(command) &&
          (nonEmpty(commandHtml) ? (
            <div
              className="code-block"
              // oxlint-disable-next-line react/no-danger -- the Shiki markup comes from the trusted command of the step
              dangerouslySetInnerHTML={{ __html: commandHtml }}
            />
          ) : (
            <pre className="whitespace-pre-wrap break-words text-foreground">
              {command}
            </pre>
          ))}

        {nonEmpty(output) && (
          <pre className="whitespace-pre-wrap break-words text-muted-foreground">
            {output}
          </pre>
        )}
      </ScrollArea>
      {trailing}
    </div>
  );
}
