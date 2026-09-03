import { GitPullRequestArrow } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useProposeLine } from '@/hooks/api/useProposeLine';

type ProposeLineProps = {
  teamId: string | undefined;
  lineId: string;
  name: string;
};

/**
 * Writes this line back to the repository. What comes back is a pull request
 * to read, not a change already made, so the button says so.
 */
export function ProposeLine({ teamId, lineId, name }: ProposeLineProps) {
  const propose = useProposeLine(teamId);
  const [opened, setOpened] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          propose.mutate(lineId, {
            onSuccess: (proposed) => setOpened(proposed?.url ?? null),
          })
        }
        disabled={propose.isPending}
        className="rounded-full bg-card shadow-none"
      >
        <GitPullRequestArrow className="size-3.5" aria-hidden />
        {propose.isPending ? 'Opening…' : `Propose ${name}`}
      </Button>

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

      {propose.isError && (
        <p className="text-amber-600 text-xs dark:text-amber-400">
          The repository has moved since it was last read. Read it again, then
          propose.
        </p>
      )}
    </div>
  );
}
