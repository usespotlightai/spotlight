import { GitPullRequest } from 'lucide-react';
import { useState } from 'react';
import { HarnessSelect } from '@/components/features/stations/HarnessSelect';
import { RepositoriesSelect } from '@/components/features/stations/RepositoriesSelect';
import { Button } from '@/components/ui/button';
import { useSetUpLines } from '@/hooks/api/useSetUpLines';
import type { OnboardingLineResponseDto } from '@/lib/api/types.gen';
import { cn } from '@/lib/utils';

type SetUpLinesProps = {
  slug: string | undefined;
  teamId: string;
  lines: readonly OnboardingLineResponseDto[];
  configRepository: string | null;
  controlClassName?: string;
};

type Assignment = { harness: string; repositories: string[] };

/** The line that improves the factory, which opens its work against the config. */
const IMPROVEMENT = 'factory-improvement';

/** What a line starts out working in: its own repositories, or the config
 *  repository for the improvement line, which has nowhere else to work. */
const reposFor = (
  line: OnboardingLineResponseDto,
  configRepository: string | null,
): string[] => {
  if (line.repositories.length > 0) {
    return [...line.repositories];
  }

  return line.key === IMPROVEMENT && configRepository ? [configRepository] : [];
};

const seededFrom = (
  lines: readonly OnboardingLineResponseDto[],
  configRepository: string | null,
): Record<string, Assignment> =>
  Object.fromEntries(
    lines.map((line) => [
      line.key,
      {
        harness: line.harness ?? '',
        repositories: reposFor(line, configRepository),
      },
    ]),
  );

/** What the lines amount to, so a fresh read of the same choices re-seeds. */
const signatureOf = (
  lines: readonly OnboardingLineResponseDto[],
  configRepository: string | null,
): string =>
  `${configRepository ?? ''}#${lines
    .map(
      (line) =>
        `${line.key}:${line.harness ?? ''}:${line.repositories.join(',')}`,
    )
    .join('|')}`;

/**
 * Each line's harness and repositories, chosen the way the station page chooses
 * them, then written down in one pull request. Nothing is written until Set up
 * is pressed, so the choices are made first.
 */
export function SetUpLines({
  slug,
  teamId,
  lines,
  configRepository,
  controlClassName,
}: SetUpLinesProps) {
  const setUp = useSetUpLines(teamId);

  const [seed, setSeed] = useState(signatureOf(lines, configRepository));
  const [assignments, setAssignments] = useState(() =>
    seededFrom(lines, configRepository),
  );

  const signature = signatureOf(lines, configRepository);
  if (signature !== seed) {
    setSeed(signature);
    setAssignments(seededFrom(lines, configRepository));
  }

  const assign = (key: string, change: Partial<Assignment>) =>
    setAssignments((all) => ({ ...all, [key]: { ...all[key], ...change } }));

  const write = () =>
    setUp.mutate(
      lines.map((line) => ({
        key: line.key,
        harness: assignments[line.key]?.harness || null,
        repositories: assignments[line.key]?.repositories ?? [],
      })),
    );

  return (
    <div className="flex w-full flex-col gap-4">
      {lines.map((line) => (
        <div key={line.key} className="flex flex-col gap-1.5">
          <p className="font-medium text-foreground text-sm">{line.name}</p>

          <div className="flex flex-col gap-1 rounded-lg border-[0.5px] border-border bg-card p-1">
            <HarnessSelect
              value={assignments[line.key]?.harness ?? ''}
              onChange={(harness) => assign(line.key, { harness })}
            />
            <RepositoriesSelect
              slug={slug}
              value={assignments[line.key]?.repositories ?? []}
              onChange={(repositories) => assign(line.key, { repositories })}
            />
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          onClick={write}
          disabled={setUp.isPending}
          className={cn(controlClassName)}
        >
          {setUp.isPending ? 'Opening…' : 'Open pull request'}
        </Button>

        {setUp.data?.url && (
          <a
            href={setUp.data.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
          >
            <GitPullRequest className="size-3.5 shrink-0" aria-hidden />
            View pull request
          </a>
        )}
      </div>

      {setUp.isError && (
        <p className="text-destructive text-sm">{setUp.error.message}</p>
      )}
    </div>
  );
}
