import { getSharedHighlighter } from '@pierre/diffs';
import { useEffect, useState } from 'react';
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
  const [commandHtml, setCommandHtml] = useState<string | null>(null);

  // Shiki paints nothing until the grammar and themes load, so show the raw command until ready.
  useEffect(() => {
    if (!command) {
      setCommandHtml(null);
      return;
    }

    let alive = true;
    setCommandHtml(null);

    void getSharedHighlighter({
      themes: [THEME.light, THEME.dark],
      langs: ['shellscript'],
    })
      .then((hl) => {
        if (alive) {
          // defaultColor: false emits --shiki-light/--shiki-dark vars that index.css switches per theme.
          setCommandHtml(
            hl.codeToHtml(command, {
              lang: 'shellscript',
              themes: THEME,
              defaultColor: false,
            }),
          );
        }
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [command]);

  return (
    <div
      className={cn(
        'max-h-64 select-text space-y-1 overflow-auto rounded-md border-[0.5px] border-border bg-muted/60 px-3 py-2 font-mono text-[11px] leading-[1.6]',
        className,
      )}
    >
      {command &&
        (commandHtml ? (
          <div
            className="code-block"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki markup for the step's own trusted command
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
    </div>
  );
}
