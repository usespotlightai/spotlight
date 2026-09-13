import { GitPullRequest } from 'lucide-react';
import { useState } from 'react';
import { HarnessSelect } from '@/components/features/stations/HarnessSelect';
import { ModelEffortSelect } from '@/components/features/stations/ModelEffortSelect';
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

type Assignment = {
  harness: string;
  model: string;
  effort: string;
  repositories: string[];
};

const IMPROVEMENT = 'factory';

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
        model: line.model ?? '',
        effort: line.effort ?? '',
        repositories: reposFor(line, configRepository),
      },
    ]),
  );

const signatureOf = (
  lines: readonly OnboardingLineResponseDto[],
  configRepository: string | null,
): string =>
  `${configRepository ?? ''}#${lines
    .map(
      (line) =>
        `${line.key}:${line.harness ?? ''}:${line.model ?? ''}:${line.effort ?? ''}:${line.repositories.join(',')}`,
    )
    .join('|')}`;

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

  const chooseHarness = (key: string, harness: string) =>
    assign(key, { harness, model: '', effort: '' });

  const write = () =>
    setUp.mutate(
      lines.map((line) => ({
        key: line.key,
        harness: assignments[line.key]?.harness || null,
        model: assignments[line.key]?.model || null,
        effort: assignments[line.key]?.effort || null,
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
              onChange={(harness) => chooseHarness(line.key, harness)}
            />
            {assignments[line.key]?.harness ? (
              <ModelEffortSelect
                harness={assignments[line.key]?.harness ?? ''}
                model={assignments[line.key]?.model ?? ''}
                onModel={(model) => assign(line.key, { model })}
                effort={assignments[line.key]?.effort ?? ''}
                onEffort={(effort) => assign(line.key, { effort })}
              />
            ) : null}
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
