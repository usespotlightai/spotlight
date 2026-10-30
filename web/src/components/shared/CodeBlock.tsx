import { getSharedHighlighter } from '@pierre/diffs';
import { useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const THEME = { light: 'github-light', dark: 'github-dark' } as const;

export function CodeBlock({
  command,
  output,
  className,
}: {
  command?: string;
  output?: string;
  className?: string;
}) {
  const [highlighted, setHighlighted] = useState<{
    command: string;
    html: string;
  } | null>(null);
  const commandHtml =
    command && highlighted?.command === command ? highlighted.html : null;

  useEffect(() => {
    if (!command) {
      return;
    }

    let alive = true;

    void getSharedHighlighter({
      themes: [THEME.light, THEME.dark],
      langs: ['shellscript'],
    })
      .then((hl) => {
        if (alive) {
          setHighlighted({
            command,
            html: hl.codeToHtml(command, {
              lang: 'shellscript',
              themes: THEME,
              defaultColor: false,
            }),
          });
        }
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [command]);

  return (
    <ScrollArea
      orientation="both"
      className="max-h-64 rounded-md border-[0.5px] border-border bg-muted/60"
      contentClassName={cn(
        'select-text space-y-1 px-3 py-2 font-mono text-[11px] leading-[1.6]',
        className,
      )}
    >
      {command &&
        (commandHtml ? (
          <div
            className="code-block"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: the Shiki markup comes from the trusted command of the step
            dangerouslySetInnerHTML={{ __html: commandHtml }}
          />
        ) : (
          <pre className="whitespace-pre-wrap break-words text-foreground">
            {command}
          </pre>
        ))}

      {output && (
        <pre className="whitespace-pre-wrap break-words text-muted-foreground">
          {output}
        </pre>
      )}
    </ScrollArea>
  );
}
