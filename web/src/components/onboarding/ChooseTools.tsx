import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useChooseTools } from '@/hooks/api/useOnboarding';
import type { KnownToolResponseDto } from '@/lib/api';

type ChooseToolsProps = {
  teamId: string | undefined;
  tools: readonly KnownToolResponseDto[];
  canWrite: boolean;
};

/**
 * The hosts this team uses. Choosing them writes a starting file for each,
 * as a pull request — nothing is listening until somebody reads it, points
 * the host at the door and sets its secret.
 */
export function ChooseTools({ teamId, tools, canWrite }: ChooseToolsProps) {
  const [picked, setPicked] = useState<string[]>([]);
  const choose = useChooseTools(teamId);
  const [opened, setOpened] = useState<string | null>(null);

  const toggle = (source: string) =>
    setPicked((held) =>
      held.includes(source)
        ? held.filter((each) => each !== source)
        : [...held, source],
    );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium text-foreground text-sm">
          Which of these does this team use?
        </h2>
        <p className="text-muted-foreground text-xs leading-5">
          Spotlight writes a starting file for each, as a pull request. Nothing
          listens until you read it, point the host at the address it gives you
          and set the secret.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {tools.map((tool) => (
          <li key={tool.source}>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 has-[:checked]:border-foreground/30">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-foreground"
                checked={tool.chosen || picked.includes(tool.source)}
                disabled={tool.chosen}
                onChange={() => toggle(tool.source)}
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground text-sm">
                  {tool.name}
                  {tool.chosen && (
                    <span className="ml-2 font-normal text-muted-foreground text-xs">
                      already written
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground text-xs leading-5">
                  {tool.summary}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={picked.length === 0 || choose.isPending || !canWrite}
          onClick={() =>
            choose.mutate(picked, {
              onSuccess: (opened) => {
                setOpened(opened?.url ?? null);
                setPicked([]);
              },
            })
          }
          className="rounded-full bg-card shadow-none"
        >
          {choose.isPending ? 'Writing…' : 'Write the configuration'}
        </Button>

        {!canWrite && (
          <p className="text-muted-foreground text-xs">
            Connect GitHub first — there is nowhere to write it yet.
          </p>
        )}

        {opened && (
          <a
            href={opened}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground text-xs underline underline-offset-2 hover:text-foreground"
          >
            Read the pull request
          </a>
        )}
      </div>
    </section>
  );
}
