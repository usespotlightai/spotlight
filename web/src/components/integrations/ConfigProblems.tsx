import { TriangleAlert } from 'lucide-react';
import type { ConfigProblemResponseDto } from '@/lib/api';

type ConfigProblemsProps = {
  problems: readonly ConfigProblemResponseDto[];
};

/**
 * What is wrong with the files, where it is. Shown rather than logged: the
 * answer to "why is my integration not running" belongs next to the thing
 * that is not running.
 */
export function ConfigProblems({ problems }: ConfigProblemsProps) {
  if (problems.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex h-6 items-center gap-1.5 font-medium text-amber-600 text-xs dark:text-amber-400">
        <TriangleAlert className="size-3.5" aria-hidden />
        {problems.length === 1
          ? '1 problem to fix'
          : `${problems.length} problems to fix`}
      </h2>

      <ul className="flex flex-col gap-2">
        {problems.map((problem) => (
          <li
            key={`${problem.path}:${problem.at}:${problem.reason}`}
            className="flex flex-col gap-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3"
          >
            <p className="font-mono text-foreground text-xs">
              {problem.path}
              <span className="text-muted-foreground"> · {problem.at}</span>
            </p>
            <p className="text-muted-foreground text-xs leading-5">
              {problem.reason}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
