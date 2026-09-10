import { getSharedHighlighter } from '@pierre/diffs';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const THEME = { light: 'github-light', dark: 'github-dark' } as const;

/**
 * A bordered terminal block: the shell command syntax-highlighted on top, its
 * output below as plain text (output is not code, so it stays uncoloured).
 * Shares the Shiki highlighter with {@link CodeDiff}; the `.dark` swap for its
 * dual theme lives in index.css.
 */
export function CodeBlock({
  command,
  output,
  className,
}: {
  /** Shell command, shown highlighted at the top. Omit for plain output only. */
  command?: string;
  /** Result text — rendered plain, since it isn't code. Omit for command only. */
  output?: string;
  className?: string;
}) {
  const [commandHtml, setCommandHtml] = useState<string | null>(null);

  // Shiki paints nothing until the grammar and both themes are loaded, so hold
  // the raw command until the shared highlighter is ready, then swap in the
  // highlighted markup. A grammar that fails to load leaves the plain fallback.
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
          // defaultColor: false emits --shiki-light / --shiki-dark CSS vars
          // instead of inline colours, so index.css picks the theme per mode
          // with a plain class rule (no !important, no inline bg to override).
          setCommandHtml(
            hl.codeToHtml(command, {
              lang: 'shellscript',
              themes: THEME,
              defaultColor: false,
            }),
          );
        }
      })
      .catch(() => {
        // leave commandHtml null → plain-text fallback below
      });

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
